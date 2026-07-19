import {
  Box,
  Button,
  TextField,
  Typography,
} from '@mui/material';

function JobForm({
  title,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  isLoading,
  buttonText,
  loadingText,
  multiline = false,
  rows = 1,
}) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <Typography variant="h4">
        {title}
      </Typography>

      <TextField
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        multiline={multiline}
        rows={multiline ? rows : undefined}
        fullWidth
        disabled={isLoading}
      />

      <Button
        variant="contained"
        size="large"
        onClick={onSubmit}
        disabled={isLoading}
      >
        {isLoading ? loadingText : buttonText}
      </Button>
    </Box>
  );
}

export default JobForm;