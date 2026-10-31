import {AppBar as MuiAppBar, Box, IconButton, Slide, Toolbar, useScrollTrigger} from "@mui/material";
import ShareIcon from '@mui/icons-material/Share';
import {useTranslation} from 'react-i18next';
import {fetchShareCode} from "../api";
import settings from "../settings";
import UserMenu from "./UserMenu.tsx";
import ListSelector from "./ListSelector.tsx";
import { useToast } from './Toast.tsx';
import logo from '/logo.svg?url';

export default function AppBar({ selectedListId, onListChange }: {
  selectedListId: string,
  onListChange: (id: string) => void
}) {
    const { t } = useTranslation();

    return (
        <>
        <HideOnScroll>
            <MuiAppBar position="fixed" sx={{ mb: 2 }}>
                <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box component="img"
                         src={logo}
                         alt={t('appName')}
                         sx={{ height: 32, width: 'auto' }} />

                    <Box sx={{
                        flexGrow: 1,
                        mx: 2,
                        maxWidth: { xs: 'calc(100vw - 180px)', sm: 'none' },
                        overflow: 'hidden',
                    }}>
                        <ListSelector value={selectedListId} onChange={onListChange} />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {selectedListId === 'mine' && <ShareButton />}
                        <UserMenu />
                    </Box>
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
    const { showToast } = useToast();
    const handleShare = async () => {
        let shareCode: string | null = null;
        try {
            shareCode = await fetchShareCode();
        } catch (error) {
            console.error('Failed to get share code:', error);
            showToast('shareCodeError', 'error');
            return;
        }

        if (!shareCode) {
            showToast('shareCodeError', 'error');
            return;
        }

        const link = buildShareLink(shareCode);

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
                showToast('shareLink', 'success');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                showToast('shareError', 'error');
            });
    };

    return (
        <IconButton
            color="primary"
            aria-label={t('share')}
            onClick={handleShare}
        >
            <ShareIcon />
        </IconButton>
    );
}

function buildShareLink(shareCode: string): string {
    const url = new URL(settings.appBasePath, window.location.origin);
    url.searchParams.set('shared', shareCode);
    return url.toString();
}
