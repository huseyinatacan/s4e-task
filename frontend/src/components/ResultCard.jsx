import {
  Card,
  CardContent,
  Typography,
} from '@mui/material';

function ResultCard({
  title,
  status,
  exitCode,
  result,
  emptyMessage,
}) {
  return (
    <Card
      sx={{
        flex: 1,
        minHeight: 250,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <CardContent sx={{ width: '100%' }}>
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>

        <Typography sx={{ mb: 1, fontWeight: 'bold' }}>
          Status: {status || 'Not started'}
        </Typography>

        {exitCode !== null && (
          <Typography sx={{ mb: 2 }}>
            Exit code: {exitCode}
          </Typography>
        )}

        <Typography
          component="pre"
          sx={{
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {result || emptyMessage}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default ResultCard;