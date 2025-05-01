import { Button } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import authClient from '../auth';

export default function LoginButton() {
    const handleLogin = async () => {
        try {
            await authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.href,
            });
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    return (
        <Button
            variant="contained"
            color="primary"
            startIcon={<GoogleIcon />}
            onClick={handleLogin}
        >
            Sign in with Google
        </Button>
    );
}
