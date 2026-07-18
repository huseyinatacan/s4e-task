import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
} from '@mui/material';

const API_URL = 'http://localhost:8000';
const MAXIMUM_POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 1000;

function App() {
  // Command job states
  const [command, setCommand] = useState('');
  const [commandJobStatus, setCommandJobStatus] = useState('');
  const [commandResult, setCommandResult] = useState('');
  const [commandJobExitCode, setCommandJobExitCode] = useState(null);
  const [isCommandJobLoading, setIsCommandJobLoading] = useState(false);

  // Crawl job states
  const [website, setWebsite] = useState('');
  const [crawlJobStatus, setCrawlJobStatus] = useState('');
  const [crawlResult, setCrawlResult] = useState('');
  const [crawlJobExitCode, setCrawlJobExitCode] = useState(null);
  const [isCrawlJobLoading, setIsCrawlJobLoading] = useState(false);

  const wait = (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });

  const getErrorMessage = async (response, defaultMessage) => {
    const errorData = await response.json().catch(() => null);

    return errorData?.detail ?? `${defaultMessage}: ${response.status}`;
  };

  // --------------------------------------------------
  // Command functions
  // --------------------------------------------------

  const checkCommandJobStatus = async (jobId) => {
    const response = await fetch(
      `${API_URL}/command-jobs/${jobId}`,
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          'Could not get command job status',
        ),
      );
    }

    return response.json();
  };

  const pollCommandJobStatus = async (jobId) => {
    for (
      let attempt = 0;
      attempt < MAXIMUM_POLL_ATTEMPTS;
      attempt += 1
    ) {
      const job = await checkCommandJobStatus(jobId);

      setCommandJobStatus(job.status);
      setCommandJobExitCode(job.exit_code ?? null);

      if (job.status === 'completed') {
        setCommandResult(
          job.output || 'Command completed successfully.',
        );

        return;
      }

      if (job.status === 'failed') {
        setCommandResult(
          job.output
            ? `Error occurred:\n${job.output}`
            : 'Error occurred: Unknown error',
        );

        return;
      }

      await wait(POLL_INTERVAL_MS);
    }

    throw new Error('The command job took too long to complete.');
  };

  const sendCommand = async () => {
    const trimmedCommand = command.trim();

    if (!trimmedCommand) {
      setCommandJobStatus('error');
      setCommandResult('Please enter a command.');
      return;
    }

    setIsCommandJobLoading(true);
    setCommandResult('');
    setCommandJobExitCode(null);
    setCommandJobStatus('submitting');

    try {
      const response = await fetch(`${API_URL}/command-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: trimmedCommand,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            'Could not create command job',
          ),
        );
      }

      const createdJob = await response.json();

      setCommandJobStatus(createdJob.status);

      await pollCommandJobStatus(createdJob.job_id);
    } catch (error) {
      setCommandJobStatus('error');
      setCommandResult(
        error instanceof Error
          ? error.message
          : 'An unknown error occurred.',
      );
    } finally {
      setIsCommandJobLoading(false);
    }
  };

  // --------------------------------------------------
  // Crawler functions
  // --------------------------------------------------

  const checkCrawlJobStatus = async (jobId) => {
    const response = await fetch(
      `${API_URL}/crawler-jobs/${jobId}`,
    );

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          'Could not get crawl job status',
        ),
      );
    }

    return response.json();
  };

  const pollCrawlJobStatus = async (jobId) => {
    for (
      let attempt = 0;
      attempt < MAXIMUM_POLL_ATTEMPTS;
      attempt += 1
    ) {
      const job = await checkCrawlJobStatus(jobId);

      setCrawlJobStatus(job.status);
      setCrawlJobExitCode(job.exit_code ?? null);

      if (job.status === 'completed') {
        setCrawlResult(
          job.output ||
            `Crawl completed successfully.${
              job.total_url_count !== undefined
                ? `\nTotal URLs: ${job.total_url_count}`
                : ''
            }`,
        );

        return;
      }

      if (job.status === 'failed') {
        setCrawlResult(
          job.output
            ? `Error occurred:\n${job.output}`
            : 'Error occurred: Unknown error',
        );

        return;
      }

      await wait(POLL_INTERVAL_MS);
    }

    throw new Error('The crawl job took too long to complete.');
  };

  const startCrawl = async () => {
    const trimmedWebsite = website.trim();

    if (!trimmedWebsite) {
      setCrawlJobStatus('error');
      setCrawlResult('Please enter a website.');
      return;
    }

    setIsCrawlJobLoading(true);
    setCrawlResult('');
    setCrawlJobExitCode(null);
    setCrawlJobStatus('submitting');

    try {
      const response = await fetch(`${API_URL}/crawler-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          website: trimmedWebsite,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            'Could not create crawl job',
          ),
        );
      }

      const createdJob = await response.json();

      setCrawlJobStatus(createdJob.status);

      await pollCrawlJobStatus(createdJob.job_id);
    } catch (error) {
      setCrawlJobStatus('error');
      setCrawlResult(
        error instanceof Error
          ? error.message
          : 'An unknown error occurred.',
      );
    } finally {
      setIsCrawlJobLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: {
          xs: 2,
          md: 4,
        },
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 1000,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {/* Command row */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: {
              xs: 'column',
              md: 'row',
            },
            gap: 4,
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h4">
              Run Command
            </Typography>

            <TextField
              label="Command"
              placeholder="Write your command here..."
              value={command}
              onChange={(event) => {
                setCommand(event.target.value);
              }}
              multiline
              rows={5}
              fullWidth
              disabled={isCommandJobLoading}
            />

            <Button
              variant="contained"
              size="large"
              onClick={sendCommand}
              disabled={isCommandJobLoading}
            >
              {isCommandJobLoading ? 'Running...' : 'Submit command'}
            </Button>
          </Box>

          <ResultCard
            title="Command Result"
            status={commandJobStatus}
            exitCode={commandJobExitCode}
            result={commandResult}
            emptyMessage="The command output will appear here."
          />
        </Box>

        {/* Crawl row */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: {
              xs: 'column',
              md: 'row',
            },
            gap: 4,
            alignItems: 'stretch',
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h4">
              Crawl Website
            </Typography>

            <TextField
              label="Website"
              placeholder="https://example.com"
              value={website}
              onChange={(event) => {
                setWebsite(event.target.value);
              }}
              fullWidth
              disabled={isCrawlJobLoading}
            />

            <Button
              variant="contained"
              size="large"
              onClick={startCrawl}
              disabled={isCrawlJobLoading}
            >
              {isCrawlJobLoading ? 'Crawling...' : 'Start crawl'}
            </Button>
          </Box>

          <ResultCard
            title="Crawl Result"
            status={crawlJobStatus}
            exitCode={crawlJobExitCode}
            result={crawlResult}
            emptyMessage="The crawl result will appear here."
          />
        </Box>
      </Box>
    </Box>
  );
}

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

export default App;