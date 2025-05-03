import {useEffect, useState} from 'react';
import {
    Checkbox,
    Container,
    CssBaseline,
    Fab,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Select,
    SelectChangeEvent,
    TextField
} from '@mui/material';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {useTranslation} from 'react-i18next';
import authClient from './auth';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import AppBar from "./components/AppBar.tsx";
import {createId} from '@paralleldrive/cuid2';

import api, {GroceryItem} from './api';
import {store} from "./store.ts";
import {Provider} from "react-redux";
import Loading from "./components/Loading.tsx";
import SignIn from "./components/SignIn.tsx";

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
            <AppBar />
            <ListSelector value={selectedListId} onChange={setSelectedListId} />
            <GroceryList listId={selectedListId} />
        </Container>
    )
}

function ListSelector({ value, onChange }: { value: string, onChange: (id: string) => void }) {
    const { t } = useTranslation();
    const { data: lists = [], isLoading } = api.endpoints.listGroceryLists.useQuery();

    const handleChange = (event: SelectChangeEvent) => {
        onChange(event.target.value);
    };

    if (isLoading || lists.length <= 1) {
        return null;
    }

    return (
        <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="list-selector-label">{t('selectList')}</InputLabel>
            <Select
                labelId="list-selector-label"
                id="list-selector"
                value={value}
                label={t('selectList')}
                onChange={handleChange}
            >
                {lists.map((list) => (
                    <MenuItem key={list.id} value={list.id}>
                        {list.name || t('sharedList', { id: list.id.substring(0, 6) })}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function ShareCodeRedeemer({ onListRedeemed }: { onListRedeemed: (id: string) => void }) {
    const [redeemShareCode] = api.endpoints.redeemShareCode.useMutation();

    useEffect(() => {
        const url = new URL(window.location.href);
        const shareCode = url.searchParams.get('shared');

        if (shareCode) {
            redeemShareCode({ shareCode })
                .unwrap()
                .then((response) => {
                    url.searchParams.delete('shared');
                    window.history.replaceState({}, document.title, url.toString());
                    if (response && response.id) {
                        onListRedeemed(response.id);
                    }
                })
                .catch(error => {
                    console.error('Error redeeming share code:', error);
                });
        }
    }, [redeemShareCode, onListRedeemed]);

    return null;
}

function GroceryList({ listId = 'mine' }: { listId?: string }) {
    const { t } = useTranslation();
    const [editingItemId, setEditingItemId] = useState<GroceryItem['id'] | null>(null);
    const {
        items,
        addItem,
        updateItem,
        deleteItem,
    } = useItemsList(listId);

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
                aria-label={t('addItem')}
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
    const { t } = useTranslation();
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
                primary={item.name || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>{t('enterItemName')}</span>}
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

function useItemsList(listId: string = 'mine') {
    const { data: groceryListData, isLoading, isError } = api.endpoints.getGroceryList.useQuery({ id: listId });
    const [updateGroceryList, { isLoading: isUpdating }] = api.endpoints.updateGroceryList.useMutation();
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
        updateGroceryList({ id: listId, items: updatedItems });
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
                updateGroceryList({ id: listId, items: updatedItems });

                setTempItem(null);
            }
            return;
        }

        const updatedItems = savedItems.map(item =>
            item.id === id ? { ...item, ...updates } : item
        );
        updateGroceryList({ id: listId, items: updatedItems });
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
