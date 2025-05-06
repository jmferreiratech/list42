import {useState} from 'react';
import {Container, CssBaseline} from '@mui/material';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import authClient from './auth';
import AppBar from "./components/AppBar.tsx";
import {store} from "./store.ts";
import {Provider} from "react-redux";
import Loading from "./components/Loading.tsx";
import SignIn from "./components/SignIn.tsx";
import ShareCodeRedeemer from "./components/ShareCodeRedeemer.tsx";
import GroceryList from "./components/GroceryList.tsx";
import { ToastProvider } from './components/Toast.tsx';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#42b883',
        },
    },
});

export default function AppWrapper() {
    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline/>
            <Provider store={store}>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </Provider>
        </ThemeProvider>
    );
}

function App() {
    const {data, isPending} = authClient.useSession();
    const [selectedListId, setSelectedListId] = useState<string>('mine');

    if (isPending) {
        return <Loading />;
    }

    if (!data) {
        return <SignIn />;
    }

    return (
        <Container maxWidth="sm" sx={{mt: 2, pb: 10}}>
            <ShareCodeRedeemer onListRedeemed={setSelectedListId} />
            <AppBar selectedListId={selectedListId} onListChange={setSelectedListId} />
            <GroceryList listId={selectedListId} />
        </Container>
    )
}
