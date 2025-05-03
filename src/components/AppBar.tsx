import { Button, Slide, Snackbar, Toolbar, Typography, useScrollTrigger, AppBar as MuiAppBar } from "@mui/material";
import ShareIcon from '@mui/icons-material/Share';
import { useState } from "react";
import api from "../api";
import UserMenu from "./UserMenu.tsx";

export default function AppBar({listName}: {listName: string}) {
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [trigger] = api.endpoints.getShareCode.useLazyQuery();

    const handleShare = async () => {
        const shareCode = await trigger().unwrap();

        if (!shareCode) {
            setSnackbarMessage('Unable to get share code');
            setSnackbarOpen(true);
            return;
        }

        const link = `${window.location.href}?shared=${shareCode}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Acesse Minha Lista',
                    text: `Quero compartilhar minha lista com você. Use o link para acessar.`,
                    url: link
                });
            } catch (error) {
                console.error('Error sharing:', error);
                copyToClipboard(link);
            }
        } else {
            copyToClipboard(link);
        }
    };

    const copyToClipboard = (link: string) => {
        navigator.clipboard.writeText(link)
            .then(() => {
                setSnackbarMessage('Share link copied to clipboard!');
                setSnackbarOpen(true);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                setSnackbarMessage('Failed to copy share link');
                setSnackbarOpen(true);
            });
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };

    return (
        <>
        <HideOnScroll>
            <MuiAppBar position="fixed" sx={{ mb: 2 }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" component="h1" color="primary">
                        {listName}
                    </Typography>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Button
                            color="primary"
                            startIcon={<ShareIcon />}
                            onClick={handleShare}
                            sx={{ mr: 2 }}
                        >
                            Share
                        </Button>
                        <UserMenu />
                    </div>
                </Toolbar>
            </MuiAppBar>
        </HideOnScroll>
        <Toolbar /> {/* This empty Toolbar acts as a spacer */}
        <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            message={snackbarMessage}
        />
        </>
    )
};

interface HideOnScrollProps {
    children: React.ReactElement;
}

function HideOnScroll(props: HideOnScrollProps) {
    const { children } = props;

    const trigger = useScrollTrigger();

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}
