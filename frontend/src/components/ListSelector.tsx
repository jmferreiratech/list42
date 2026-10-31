import {useTranslation} from "react-i18next";
import api from "../api.ts";
import {FormControl, MenuItem, Select, SelectChangeEvent, Typography} from "@mui/material";

export default function ListSelector({ value, onChange }: { value: string, onChange: (id: string) => void }) {
    const { t } = useTranslation();
    const { data: lists = [], isLoading } = api.endpoints.listGroceryLists.useQuery();

    const handleChange = (event: SelectChangeEvent) => {
        onChange(event.target.value);
    };

    if (isLoading) {
        return null;
    }

    if (lists.length <= 1) {
        return (
            <Typography variant="h6" component="h1" noWrap>
                {lists[0]?.name || t('appName')}
            </Typography>
        );
    }

    return (
        <FormControl fullWidth size="small" variant="outlined">
            <Select
                id="list-selector"
                value={value}
                onChange={handleChange}
                displayEmpty
                sx={{
                    color: 'white',
                    '.MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255, 255, 255, 0.5)'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'white'
                    },
                    '.MuiSvgIcon-root': {
                        color: 'white'
                    }
                }}
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
