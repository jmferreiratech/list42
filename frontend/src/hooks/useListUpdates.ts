import { useEffect, useRef, useState } from 'react';
import { fetchUpdatesTicket } from '../api.ts';
import useIsOnline from './useIsOnline.ts';

// The server closes a connection that is quiet for 10 minutes.
const PING_INTERVAL_MS = 5 * 60_000;
const FIRST_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60_000;

interface ListChangedMessage {
    type: 'listChanged';
    updatedAt: string | null;
}

/**
 * Keeps a connection open that tells when the list changes, and reconnects with a growing delay when it drops.
 * `onChange` gets the list's time after the change, or null when changes may have been missed (each time it connects).
 * Returns whether the connection is open.
 */
export default function useListUpdates(listId: string, onChange: (updatedAt: string | null) => void): boolean {
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
            let url: string;
            try {
                const ticket = await fetchUpdatesTicket(listId);
                url = `${ticket.url}?${new URLSearchParams({ token: ticket.token })}`;
            } catch {
                if (!stopped) retryLater();
                return;
            }
            if (stopped) return;

            const current = new WebSocket(url);
            socket = current;
            current.onopen = () => {
                retryDelay = FIRST_RETRY_DELAY_MS;
                setIsConnected(true);
                pingTimer = setInterval(() => current.send(JSON.stringify({ action: 'ping' })), PING_INTERVAL_MS);
                // Changes made while it was not connected were not told.
                onChangeRef.current(null);
            };
            current.onmessage = event => {
                const message = parseMessage(event.data);
                if (message?.type === 'listChanged') {
                    onChangeRef.current(message.updatedAt);
                }
            };
            // Also follows a failed attempt, and the server's 2-hour limit per connection.
            current.onclose = () => {
                clearInterval(pingTimer);
                setIsConnected(false);
                if (!stopped) retryLater();
            };
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

function parseMessage(data: unknown): ListChangedMessage | null {
    if (typeof data !== 'string') return null;
    try {
        return JSON.parse(data) as ListChangedMessage;
    } catch {
        return null;
    }
}
