import MuiAppBar from "@mui/material/AppBar";
import {Box, Container, Paper, Toolbar, Typography} from "@mui/material";
import logo from '/logo.svg?url';
import LoginButton from "./LoginButton.tsx";

export default function SignIn({listName}: {listName: string}) {
    return (
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SignInAppBar listName={listName} />
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
                    Sign in to {listName}
                </Typography>
                <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
                    Please sign in to create and manage your grocery list.
                </Typography>
                <LoginButton />
            </Paper>
        </Container>
    );
}

export function SignInAppBar({listName}: {listName: string}) {
    return (
        <MuiAppBar position="fixed" sx={{ mb: 2 }}>
            <Toolbar sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <img src={logo} alt="Logo" style={{ height: 24, marginRight: 8 }} />
                    <Typography variant="h6" component="h1" color="primary">
                        {listName}
                    </Typography>
                </Box>
            </Toolbar>
        </MuiAppBar>
    );
}
