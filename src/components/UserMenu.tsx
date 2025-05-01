import { useState } from 'react';
import { Button, Menu, MenuItem, Avatar, Typography, Box } from '@mui/material';
import authClient from '../auth.ts';

// type Session = authClient.$Infer.Session;

export default function UserMenu() {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
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
            await authClient.signOut();
            handleClose();
        } catch (error) {
            // ToDo: tratar tentativa de deslogar sem cookie (sessão)
            console.error('Logout failed:', error);
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
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
        </>
    );
}
