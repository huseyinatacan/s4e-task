import { useState } from 'react';
import { Box } from '@mui/material';

import JobForm from './components/JobForm';
import ResultCard from './components/ResultCard';
import { createJobHandler } from './services/createJobHandler';

const API_URL = 'http://localhost:8000';

function App() {
  // Command state
  const [command, setCommand] = useState('');
  const [commandJobStatus, setCommandJobStatus] = useState('');
  const [commandResult, setCommandResult] = useState('');
  const [commandJobExitCode, setCommandJobExitCode] = useState(null);
  const [isCommandJobLoading, setIsCommandJobLoading] = useState(false);

  // Crawl state
  const [website, setWebsite] = useState('');
  const [crawlJobStatus, setCrawlJobStatus] = useState('');
  const [crawlResult, setCrawlResult] = useState('');
  const [crawlJobExitCode, setCrawlJobExitCode] = useState(null);
  const [isCrawlJobLoading, setIsCrawlJobLoading] = useState(false);

  const commandJobHandler = createJobHandler({
    endpoint: `${API_URL}/command-jobs`,

    setStatus: setCommandJobStatus,
    setResult: setCommandResult,
    setExitCode: setCommandJobExitCode,
    setIsLoading: setIsCommandJobLoading,

    createRequestBody: (value) => ({
      command: value.trim(),
    }),

    validate: (value) => {
      if (!value.trim()) {
        return 'Please enter a command.';
      }

      return null;
    },

    getCompletedResult: (job) =>
      job.output || 'Command completed successfully.',

    getFailedResult: (job) =>
      job.output
        ? `Command failed:\n${job.output}`
        : 'Command failed: Unknown error',

    timeoutMessage: 'The command took too long to complete.',
  });

  const crawlJobHandler = createJobHandler({
    endpoint: `${API_URL}/crawler-jobs`,

    setStatus: setCrawlJobStatus,
    setResult: setCrawlResult,
    setExitCode: setCrawlJobExitCode,
    setIsLoading: setIsCrawlJobLoading,

    createRequestBody: (value) => ({
      website: value.trim(),
    }),

    validate: (value) => {
      const trimmedWebsite = value.trim();

      if (!trimmedWebsite) {
        return 'Please enter a website.';
      }

      try {
        new URL(trimmedWebsite);
        return null;
      } catch {
        return 'Please enter a valid website URL.';
      }
    },

    getCompletedResult: (job) => {
      const output =
        job.output || 'Crawl completed successfully.';

      if (job.total_url_count === undefined) {
        return output;
      }

      return `${output}\nTotal URLs: ${job.total_url_count}`;
    },

    getFailedResult: (job) =>
      job.output
        ? `Crawl failed:\n${job.output}`
        : 'Crawl failed: Unknown error',

    timeoutMessage: 'The crawl took too long to complete.',
  });

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
          <JobForm
            title="Run Command"
            label="Command"
            placeholder="Write your command here..."
            value={command}
            onChange={setCommand}
            onSubmit={() => {
              commandJobHandler.submitJob(command);
            }}
            isLoading={isCommandJobLoading}
            buttonText="Run command"
            loadingText="Running..."
            multiline
            rows={5}
          />

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
          <JobForm
            title="Crawl Website"
            label="Website"
            placeholder="https://example.com"
            value={website}
            onChange={setWebsite}
            onSubmit={() => {
              crawlJobHandler.submitJob(website);
            }}
            isLoading={isCrawlJobLoading}
            buttonText="Start crawl"
            loadingText="Crawling..."
          />

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

export default App;