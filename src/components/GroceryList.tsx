import {TouchEvent, useMemo, useRef, useState} from 'react';
import {
    Autocomplete,
    Box,
    Checkbox,
    Fab,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Tab,
    Tabs,
    Collapse,
    TextField
} from '@mui/material';
import {useTranslation} from 'react-i18next';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {createId} from '@paralleldrive/cuid2';

import api, {GroceryItem} from '../api';
import { useToast } from './Toast.tsx';
import {TransitionGroup} from "react-transition-group";

export default function GroceryList({ listId = 'mine' }: { listId?: string }) {
    const { t } = useTranslation();
    const [editingItemId, setEditingItemId] = useState<GroceryItem['id'] | null>(null);
    const [activeTab, setActiveTab] = useState(0);
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

    const handleSave = async (id: GroceryItem['id'], name: GroceryItem['name']) => {
        await updateItem(id, { name });

        if (id.startsWith('new')) {
            const newId = addItem();
            setEditingItemId(newId);
        } else {
            setEditingItemId(null);
        }
    };

    const handleAdd = () => {
        const newId = addItem();
        setEditingItemId(newId);
        setActiveTab(0);
    };

    const handleToggle = (id: GroceryItem['id'], completed: GroceryItem['completed']) => {
        updateItem(id, { completed: !completed });
        if (editingItemId === id)
            setEditingItemId(null);
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const filteredItems = items.filter(item =>
        activeTab === 0 ? !item.completed : item.completed
    );

    return (
        <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    aria-label="grocery list tabs"
                    variant="fullWidth"
                    sx={{ width: '100%' }}
                >
                    <Tab label={t('pending')} id="pending-tab" aria-controls="pending-panel" />
                    <Tab label={t('completed')} id="completed-tab" aria-controls="completed-panel" />
                </Tabs>
            </Box>
            <HorizontalSwipeRegion onChange={val => setActiveTab(val === 'left' ? 1 : 0)}>
                <List>
                    <TransitionGroup>
                        {filteredItems.map((item) => (
                            <Collapse key={item.id}>
                                {
                                    editingItemId === item.id ? (
                                        <EditingItem
                                            item={item}
                                            onSave={handleSave}
                                            handleDeleteItem={handleDelete}
                                            handleToggleComplete={(id, value) => handleToggle(id, value)}
                                            selectedList={listId}
                                        />
                                    ) : (
                                        <Item
                                            item={item}
                                            handleToggleComplete={() => handleToggle(item.id, item.completed)}
                                            handleDeleteItem={handleDelete}
                                            setEditingItemId={setEditingItemId}
                                        />
                                    )
                                }
                            </Collapse>
                        ))}
                    </TransitionGroup>
                </List>
            </HorizontalSwipeRegion>
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

function HorizontalSwipeRegion({children, onChange}: {children: React.ReactElement, onChange: (val: 'left'|'right') => void}) {
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const minSwipeDistance = 50;

    const handleTouchStart = (e: TouchEvent) => {
        touchStartX.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
        touchEndX.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (!touchStartX.current || !touchEndX.current) return;

        const distance = touchStartX.current - touchEndX.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            onChange('left');
        } else if (isRightSwipe) {
            onChange('right');
        }

        touchStartX.current = null;
        touchEndX.current = null;
    };

    return (
        <Box
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {children}
        </Box>
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
    const [checked, setChecked] = useState<boolean>(item.completed);

    const handleChecked = () => {
        setChecked(val => {
            setTimeout(() => handleToggleComplete(item.id), 0);
            return !val;
        })
    };

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
                checked={checked}
                tabIndex={-1}
                disableRipple
                inputProps={{ 'aria-labelledby': `list-item-label-${item.id}` }}
                onClick={handleChecked}
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
    const { showToast } = useToast();
    const [tempItem, setTempItem] = useState<GroceryItem | null>(null);
    const { data: groceryListData, isLoading, isError } = api.endpoints.getGroceryList.useQuery({ id: listId });
    const [addGroceryListItem, { isLoading: isAdding }] = api.endpoints.addItem.useMutation();
    const [updateGroceryListItem, { isLoading: isUpdating }] = api.endpoints.updateItem.useMutation();
    const [deleteGroceryListItem, { isLoading: isDeleting }] = api.endpoints.deleteItem.useMutation();

    const savedItems = groceryListData?.items || [];

    const sortItemsByUpdatedAt = (items: GroceryItem[]): GroceryItem[] => {
        return [...items].sort((a, b) => {
            if (!a.updatedAt) return -1;

            if (!b.updatedAt) return 1;

            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
    };

    const items = tempItem ? [tempItem, ...sortItemsByUpdatedAt(savedItems)] : sortItemsByUpdatedAt(savedItems);

    const addItem = (): GroceryItem['id'] => {
        const newItem: GroceryItem = {
            id: `new-${createId()}`,
            name: '',
            completed: false,
        };

        setTempItem(newItem);

        return newItem.id;
    };

    const deleteItem = async (id: GroceryItem['id']) => {
        if (id.startsWith('new') && tempItem) {
            setTempItem(null);
            return;
        }

        const itemToDelete = savedItems.find(item => item.id === id);
        if (itemToDelete) {
            try {
                await deleteGroceryListItem({ id: listId, item: itemToDelete }).unwrap();
            } catch (error) {
                console.error('Failed to delete item:', error);
                showToast('deleteItemError', 'error');
            }
        }
    };

    const updateItem = async (id: GroceryItem['id'], updates: Partial<Omit<GroceryItem, 'id'>>) => {
        if (id.startsWith('new') && tempItem) {
            const updatedTempItem = { ...tempItem, ...updates };

            setTempItem(updatedTempItem);

            if (updates.name !== undefined && updates.name.trim() !== '') {
                const itemToSave = {
                    ...updatedTempItem,
                    id: createId()
                };

                try {
                    await addGroceryListItem({ id: listId, item: itemToSave }).unwrap();
                    setTempItem(null);
                } catch (error) {
                    console.error('Failed to add item:', error);
                    showToast('addItemError', 'error');
                }
            }
            return;
        }

        const existingItem = savedItems.find(item => item.id === id);
        if (existingItem) {
            const updatedItem = { ...existingItem, ...updates };

            const hasChanged = Object.keys(updates).some(key => {
                return updates[key as keyof typeof updates] !== existingItem[key as keyof typeof existingItem];
            });

            if (hasChanged) {
                try {
                    await updateGroceryListItem({ id: listId, item: updatedItem }).unwrap();
                } catch (error) {
                    console.error('Failed to update item:', error);
                    showToast('updateItemError', 'error');
                }
            }
        }
    };

    return {
        items,
        addItem,
        updateItem,
        deleteItem,
        isLoading,
        isUpdating: isAdding || isUpdating || isDeleting,
        isError,
    };
}

interface EditingItemProps {
    item: GroceryItem;
    onSave: (id: GroceryItem['id'], name: GroceryItem['name']) => Promise<void>;
    handleDeleteItem: (id: GroceryItem['id']) => void;
    handleToggleComplete: (id: GroceryItem['id'], currentValue: boolean) => void;
    selectedList: string;
}

function EditingItem({
    item,
    onSave,
    handleDeleteItem,
    handleToggleComplete,
    selectedList,
}: EditingItemProps) {
    const [currentName, setCurrentName] = useState(item.name);
    const { data: groceryListData } = api.endpoints.getGroceryList.useQuery({ id: selectedList });
    const saveInProgress = useRef(false);

    const suggestions = useMemo(() => {
        if (!groceryListData?.items) return [];
        return Array.from(new Set(
            groceryListData.items.map(item => item.name)
        )).filter(name => name.trim() !== '');
    }, [groceryListData]);
    
    const saveChanges =  async () => {
        if (saveInProgress.current)
             return;

        saveInProgress.current = true;
        
        const trimmedName = currentName.trim();
        if (trimmedName === '') {
            handleDeleteItem(item.id);
        } else {
            const existingItem = groceryListData?.items.find(i => i.name.trim().toLocaleLowerCase() === trimmedName.toLocaleLowerCase() && i.completed);
            if (existingItem) {
                handleToggleComplete(existingItem.id, existingItem.completed);
                setCurrentName('');
            } else {
                await onSave(item.id, trimmedName);
            }
        }
        
        setTimeout(() => {
            saveInProgress.current = false;
        }, 100);
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            saveChanges();
        }
    };

    const handleAutocompleteChange = (_: React.SyntheticEvent, value: string | null) => {
        if (value) {
            setCurrentName(value);

            const existingItem = groceryListData?.items.find(i => i.name === value && i.completed);
            if (existingItem) {
                handleToggleComplete(existingItem.id, existingItem.completed);
                setCurrentName('');
            }
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
                onClick={() => handleToggleComplete(item.id, item.completed)}
                disabled
            />

            <Autocomplete
                freeSolo
                value={currentName}
                disableClearable
                clearOnBlur
                onChange={handleAutocompleteChange}
                onInputChange={(_, newInputValue) => {
                    setCurrentName(newInputValue);
                }}
                options={suggestions}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        variant="standard"
                        fullWidth
                        sx={{ ml: 1 }}
                        InputProps={{
                            ...params.InputProps,
                            disableUnderline: true
                        }}
                        onBlur={saveChanges}
                        onKeyUp={handleKeyPress}
                        autoFocus
                    />
                )}
                sx={{ width: '100%', ml: 1 }}
            />

        </ListItem>
    );
}
