import {AppBar as MuiAppBar, Button, Slide, Snackbar, Toolbar, Typography, useScrollTrigger} from "@mui/material";
import ShareIcon from '@mui/icons-material/Share';
import {useState} from "react";
import {useTranslation} from 'react-i18next';
import api from "../api";
import UserMenu from "./UserMenu.tsx";

export default function AppBar() {
    const { t } = useTranslation();

    return (
        <>
        <HideOnScroll>
            <MuiAppBar position="fixed" sx={{ mb: 2 }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" component="h1" color="primary">
                        {t('appName')}
                    </Typography>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <ShareButton />
                        <UserMenu />
                    </div>
                </Toolbar>
            </MuiAppBar>
        </HideOnScroll>
        <Toolbar /> {/* This empty Toolbar acts as a spacer */}
        </>
    )
};

function HideOnScroll(props: {children: React.ReactElement}) {
    const { children } = props;

    const trigger = useScrollTrigger();

    return (
        <Slide appear={false} direction="down" in={!trigger}>
            {children}
        </Slide>
    );
}

function ShareButton() {
    const { t } = useTranslation();
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [trigger] = api.endpoints.getShareCode.useLazyQuery();

    const handleShare = async () => {
        const shareCode = await trigger().unwrap();

        if (!shareCode) {
            setSnackbarMessage(t('shareCodeError'));
            setSnackbarOpen(true);
            return;
        }

        const link = `${window.location.href}?shared=${shareCode}`;

        if (navigator.share) {
            try {
                await navigator.share({
                    title: t('shareTitle'),
                    text: t('shareMessage'),
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
                setSnackbarMessage(t('shareLink'));
                setSnackbarOpen(true);
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                setSnackbarMessage(t('shareError'));
                setSnackbarOpen(true);
            });
    };

    const handleCloseSnackbar = () => {
        setSnackbarOpen(false);
    };


    return (
        <>
            <Button
                color="primary"
                startIcon={<ShareIcon />}
                onClick={handleShare}
                sx={{ mr: 2 }}
            >
                {t('share')}
            </Button>
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                message={snackbarMessage}
            />
        </>
    );
}
