import { useState } from 'react';
import { Button, Menu, MenuItem, Avatar, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from './Auth.tsx';
import { useToast } from './Toast.tsx';

export default function UserMenu() {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const authClient = useAuth();
    const { showToast } = useToast();
    const {data, isPending} = authClient.useSession()

    if (isPending || !data)
        return null;

    const {user} = data;

    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            const { error } = await authClient.signOut();
            if (error) {
                throw error;
            }
            handleClose();
        } catch (error) {
            console.error('Logout failed:', error);
            showToast('signOutError', 'error');
        }
    };

    return (
        <>
            <Button
                onClick={handleClick}
                sx={{ p: 0.5 }}
            >
                <Avatar
                    src={user.image ?? ''}
                    alt={user.name || 'User'}
                    sx={{
                        width: 32,
                        height: 32,
                        border: '2px solid',
                        borderColor: 'primary.main'
                    }}
                />
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                <Box sx={{ px: 2, py: 1 }}>
                    <Typography variant="subtitle1">{user.name || 'User'}</Typography>
                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                </Box>
                <MenuItem onClick={handleLogout}>{t('logout')}</MenuItem>
            </Menu>
        </>
    );
}
