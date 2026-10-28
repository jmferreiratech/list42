import MuiAppBar from "@mui/material/AppBar";
import {Box, Container, Paper, Toolbar, Typography} from "@mui/material";
import { useTranslation } from 'react-i18next';
import logo from '/logo.svg?url';
import LoginButton from "./LoginButton.tsx";

export default function SignIn() {
    const { t } = useTranslation();
    return (
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SignInAppBar />
            <Paper
                elevation={3}
                sx={{
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mt: 4
                }}
            >
                <Typography component="h1" variant="h5" gutterBottom>
                    {t('signIn', { appName: t('appName') })}
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
                    {t('signInMessage')}
                </Typography>
                <LoginButton />
            </Paper>
        </Container>
    );
}

export function SignInAppBar() {
    const { t } = useTranslation();
    return (
        <MuiAppBar position="fixed" sx={{ mb: 2 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img src={logo} alt="Logo" style={{ height: 24, marginRight: 8 }} />
                    <Typography variant="h6" component="h1" color="primary">
                        {t('appName')}
                    </Typography>
                </Box>
            </Toolbar>
        </MuiAppBar>
    );
}
