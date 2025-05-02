import {useState} from 'react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {
    Box,
    Checkbox,
    CircularProgress,
    Container,
    CssBaseline,
    Fab,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Paper,
    TextField,
    Toolbar,
    Typography,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import authClient from './auth';
import LoginButton from './components/LoginButton';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AppBar from "./components/AppBar.tsx";
import {createId} from '@paralleldrive/cuid2';
import logo from '/logo.svg?url';

import {GroceryItem, useGetGroceryListQuery, useUpdateGroceryListMutation,} from './api';
import {store} from "./store.ts";
import {Provider} from "react-redux";

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
                <App />
            </Provider>
        </ThemeProvider>
    );
}

const listName = 'List42';

function App() {
    const {data, isPending} = authClient.useSession()

    if (isPending) {
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

    if (!data) {
        return <SignIn/>;
    }

    return (
        <Container maxWidth="sm" sx={{mt: 2, pb: 10}}>
            <AppBar listName={listName} />
            <GroceryList/>
        </Container>
    )
}

function SignInAppBar({listName}: {listName: string}) {
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

function SignIn() {
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

function GroceryList() {
    const [editingItemId, setEditingItemId] = useState<GroceryItem['id'] | null>(null);
    const {
        items,
        addItem,
        updateItem,
        deleteItem,
    } = useItemsList();

    const handleDelete = (id: GroceryItem['id']) => {
        deleteItem(id);
        if (editingItemId === id) {
            setEditingItemId(null);
        }
    };

    const handleSave = (id: GroceryItem['id'], name: GroceryItem['name']) => {
        updateItem(id, { name });
        setEditingItemId(null);
    };

    const handleAdd = () => {
        const newId = addItem();
        setEditingItemId(newId);
    };

    const handleToggle = (id: GroceryItem['id'], completed: GroceryItem['completed']) => {
        updateItem(id, { completed: !completed });
        if (editingItemId === id)
            setEditingItemId(null);
    };

    return (
        <>
            <List>
                {items.map((item) => (
                    editingItemId === item.id ? (
                        <EditingItem
                            key={item.id}
                            item={item}
                            onSave={handleSave}
                            handleDeleteItem={handleDelete}
                            handleToggleComplete={() => handleToggle(item.id, item.completed)}
                        />
                    ) : (
                        <Item
                            key={item.id}
                            item={item}
                            handleToggleComplete={() => handleToggle(item.id, item.completed)}
                            handleDeleteItem={handleDelete}
                            setEditingItemId={setEditingItemId}
                        />
                    )
                ))}
            </List>
            <Fab
                color="primary"
                aria-label="add"
                sx={{position: 'fixed', bottom: 32, right: 32}}
                onClick={handleAdd}
                disabled={editingItemId !== null && items.length > 0 && items[0].id === editingItemId && items[0].name.trim() === ''}
            >
                <AddIcon/>
            </Fab>
        </>
    )
}

interface ItemProps {
    item: GroceryItem;
    handleToggleComplete: (id: GroceryItem['id']) => void;
    handleDeleteItem: (id: GroceryItem['id']) => void;
    setEditingItemId: (id: GroceryItem['id']) => void;
}

function Item({ item, handleToggleComplete, handleDeleteItem, setEditingItemId }: ItemProps) {
    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteItem(item.id)}
                >
                    <DeleteIcon />
                </IconButton>
            }
            disablePadding
        >
            <Checkbox
                edge="start"
                checked={item.completed}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onClick={() => handleToggleComplete(item.id)}
            />
            <ListItemText
                id={`list-item-label-${item.id}`}
                primary={item.name || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Enter item name...</span>}
                sx={{
                    textDecoration: item.completed ? 'line-through' : 'none',
                    color: item.completed ? 'text.secondary' : 'text.primary',
                    cursor: 'pointer',
                }}
                onClick={() => setEditingItemId(item.id)}
            />
        </ListItem>
    );
}

function useItemsList() {
    const { data: groceryListData, isLoading, isError } = useGetGroceryListQuery();
    const [updateGroceryList, { isLoading: isUpdating }] = useUpdateGroceryListMutation();
    const [tempItem, setTempItem] = useState<GroceryItem | null>(null);

    const savedItems = groceryListData?.items || [];

    const items = tempItem ? [tempItem, ...savedItems] : savedItems;

    const addItem = (): GroceryItem['id'] => {
        const newItem: GroceryItem = {
            id: 'new',
            name: '',
            completed: false,
        };

        setTempItem(newItem);

        return newItem.id;
    };

    const deleteItem = (id: GroceryItem['id']) => {
        if (id === 'new' && tempItem) {
            setTempItem(null);
            return;
        }

        const updatedItems = savedItems.filter((item) => item.id !== id);
        updateGroceryList({ items: updatedItems });
    };

    const updateItem = (id: GroceryItem['id'], updates: Partial<Omit<GroceryItem, 'id'>>) => {
        if (id === 'new' && tempItem) {
            const updatedTempItem = { ...tempItem, ...updates };

            setTempItem(updatedTempItem);

            if (updates.name !== undefined && updates.name.trim() !== '') {
                const itemToSave = {
                    ...updatedTempItem,
                    id: createId()
                };

                const updatedItems = [itemToSave, ...savedItems];
                updateGroceryList({ items: updatedItems });

                setTempItem(null);
            }
            return;
        }

        const updatedItems = savedItems.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
        updateGroceryList({ items: updatedItems });
    };

    return {
        items,
        addItem,
        updateItem,
        deleteItem,
        isLoading,
        isUpdating,
        isError,
    };
}

interface EditingItemProps {
    item: GroceryItem;
    onSave: (id: GroceryItem['id'], name: GroceryItem['name']) => void;
    handleDeleteItem: (id: GroceryItem['id']) => void;
    handleToggleComplete: (id: GroceryItem['id']) => void;
}

function EditingItem({
    item,
    onSave,
    handleDeleteItem,
    handleToggleComplete,
}: EditingItemProps) {
    const [currentName, setCurrentName] = useState(item.name);

    const saveChanges = () => {
        const trimmedName = currentName.trim();
        if (trimmedName === '') {
            handleDeleteItem(item.id);
        } else {
            onSave(item.id, trimmedName);
        }
    };


    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            saveChanges();
        }
    };

    return (
        <ListItem
            secondaryAction={
                <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDeleteItem(item.id)}
                    disabled
                >
                    <DeleteIcon />
                </IconButton>
            }
            disablePadding
        >
            <Checkbox
                edge="start"
                checked={item.completed}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onClick={() => handleToggleComplete(item.id)}
                disabled
            />
            <TextField
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                onBlur={saveChanges}
                onKeyPress={handleKeyPress}
                autoFocus
                variant="standard"
                fullWidth
                sx={{ ml: 1 }}
                InputProps={{ disableUnderline: true }}
            />
        </ListItem>
    );
}
