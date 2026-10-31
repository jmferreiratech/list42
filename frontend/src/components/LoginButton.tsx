import { Button } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useTranslation } from 'react-i18next';
import { useAuth } from './Auth';
import { useToast } from './Toast';

export default function LoginButton() {
    const authClient = useAuth();
    const { t } = useTranslation();
    const { showToast } = useToast();

    const handleLogin = async () => {
        try {
            const { error } = await authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.href,
            });
            if (error) {
                throw error;
            }
        } catch (error) {
            console.error('Login failed:', error);
            showToast('signInError', 'error');
        }
    };

    return (
        <Button
            variant="contained"
            color="primary"
            startIcon={<GoogleIcon />}
            onClick={handleLogin}
        >
            {t('signInWithGoogle')}
        </Button>
    );
}
