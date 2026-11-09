import { useEffect, useRef, useState } from 'react';
import { fetchUpdatesTicket } from '../api.ts';
import useIsOnline from './useIsOnline.ts';

// The server closes a connection that is quiet for 10 minutes.
const PING_INTERVAL_MS = 5 * 60_000;
const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

interface ListChangedMessage {
    type: 'listChanged';
    version: number;
}

/**
 * Keeps a connection open that tells when the list changes, and reconnects with a growing delay when it drops.
 * `onChange` gets the list's version after the change, or null when changes may have been missed: each time it
 * connects, since a list opened from the cache isn't fetched on its own, and a change saved before the connection
 * was stored isn't told.
 * Returns whether the connection is open.
 */
export default function useListUpdates(listId: string, onChange: (version: number | null) => void): boolean {
    const isOnline = useIsOnline();
    const [isConnected, setIsConnected] = useState(false);
    const onChangeRef = useRef(onChange);

    useEffect(() => {
        onChangeRef.current = onChange;
    });

    useEffect(() => {
        if (!isOnline) {
            return;
        }

        let stopped = false;
        let socket: WebSocket | null = null;
        let retryDelay = FIRST_RETRY_DELAY_MS;
        let retryTimer: ReturnType<typeof setTimeout> | undefined;
        let pingTimer: ReturnType<typeof setInterval> | undefined;

        const retryLater = () => {
            retryTimer = setTimeout(connect, retryDelay);
            retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
        };

        async function connect() {
            let current: WebSocket;
            try {
                const ticket = await fetchUpdatesTicket(listId);
                if (stopped) return;
                // Throws right away for a URL it can't use.
                current = new WebSocket(`${ticket.url}?${new URLSearchParams({ token: ticket.token })}`);
            } catch {
                if (!stopped) retryLater();
                return;
            }

            socket = current;
            current.addEventListener('open', () => {
                retryDelay = FIRST_RETRY_DELAY_MS;
                setIsConnected(true);
                pingTimer = setInterval(() => current.send(JSON.stringify({ action: 'ping' })), PING_INTERVAL_MS);
                // Changes made while it was not connected were not told.
                onChangeRef.current(null);
            });
            current.addEventListener('message', event => {
                const message = parseMessage(event.data);
                if (message) onChangeRef.current(message.version);
            });
            // Also follows a failed attempt, and the server's 2-hour limit per connection.
            current.addEventListener('close', () => {
                clearInterval(pingTimer);
                setIsConnected(false);
                if (!stopped) retryLater();
            });
        }

        connect();

        return () => {
            stopped = true;
            clearTimeout(retryTimer);
            clearInterval(pingTimer);
            socket?.close();
            setIsConnected(false);
        };
    }, [listId, isOnline]);

    return isConnected;
}

// Anything but a well-formed change message is ignored.
function parseMessage(data: unknown): ListChangedMessage | null {
    if (typeof data !== 'string') return null;
    let message: unknown;
    try {
        message = JSON.parse(data);
    } catch {
        return null;
    }
    if (typeof message !== 'object' || message === null) return null;
    const { type, version } = message as Record<string, unknown>;
    if (type !== 'listChanged' || typeof version !== 'number' || !Number.isFinite(version)) return null;
    return { type, version };
}
