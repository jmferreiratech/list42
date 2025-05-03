import {Box, CircularProgress, Container, Typography} from "@mui/material";
import {SignInAppBar} from './SignIn.tsx';

export default function Loading({listName}: {listName: string}) {
    return (
        <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SignInAppBar listName={listName} />
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh'
            }}>
                <CircularProgress color="primary" />
                <Typography variant="body1" sx={{ mt: 2 }}>
                    Loading...
                </Typography>
            </Box>
        </Container>
    );
}
