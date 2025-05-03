import {Box, CircularProgress, Container, Typography} from "@mui/material";
import {SignInAppBar} from './SignIn.tsx';
import { useTranslation } from 'react-i18next';

export default function Loading() {
    const { t } = useTranslation();
    return (
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SignInAppBar />
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh'
            }}>
                <CircularProgress color="primary" />
                <Typography variant="body1" sx={{ mt: 2 }}>
                    {t('loading')}
                </Typography>
            </Box>
        </Container>
    );
}
