import api from "../api.ts";
import {useEffect} from "react";

export default function ShareCodeRedeemer({ onListRedeemed }: { onListRedeemed: (id: string) => void }) {
    const [redeemShareCode] = api.endpoints.redeemShareCode.useMutation();

    useEffect(() => {
        const url = new URL(window.location.href);
        const shareCode = url.searchParams.get('shared');

        if (shareCode) {
            redeemShareCode({ shareCode })
                .unwrap()
                .then((response) => {
                    url.searchParams.delete('shared');
                    window.history.replaceState({}, document.title, url.toString());
                    if (response && response.id) {
                        onListRedeemed(response.id);
                    }
                })
                .catch(error => {
                    console.error('Error redeeming share code:', error);
                });
        }
    }, [redeemShareCode, onListRedeemed]);

    return null;
}

