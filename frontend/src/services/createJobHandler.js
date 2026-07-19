const DEFAULT_MAXIMUM_ATTEMPTS = 60;
const DEFAULT_POLL_INTERVAL_MS = 1000;

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getErrorMessage = async (response, defaultMessage) => {
  const errorData = await response.json().catch(() => null);

  return errorData?.detail ?? `${defaultMessage}: ${response.status}`;
};

export function createJobHandler({
  endpoint,

  // React setters
  setStatus,
  setResult,
  setExitCode,
  setIsLoading,

  // Request configuration
  createRequestBody,

  // Response getters
  getJobId = (job) => job.job_id,
  getStatus = (job) => job.status,
  getExitCode = (job) => job.exit_code ?? null,

  // Response-checking functions
  isCompleted = (job) => job.status === 'completed',
  isFailed = (job) => job.status === 'failed',

  // Result-formatting functions
  getCompletedResult = (job) =>
    job.output || 'Job completed successfully.',

  getFailedResult = (job) =>
    job.output
      ? `Error occurred:\n${job.output}`
      : 'Error occurred: Unknown error',

  // Validation and messages
  validate,
  createErrorMessage = 'Could not create job',
  statusErrorMessage = 'Could not get job status',
  timeoutMessage = 'The job took too long to complete.',

  maximumAttempts = DEFAULT_MAXIMUM_ATTEMPTS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}) {
  const checkJobStatus = async (jobId) => {
    const response = await fetch(`${endpoint}/${jobId}`);

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, statusErrorMessage),
      );
    }

    return response.json();
  };

  const pollJobStatus = async (jobId) => {
    for (
      let attempt = 0;
      attempt < maximumAttempts;
      attempt += 1
    ) {
      const job = await checkJobStatus(jobId);

      setStatus(getStatus(job));
      setExitCode(getExitCode(job));

      if (isCompleted(job)) {
        setResult(getCompletedResult(job));
        return job;
      }

      if (isFailed(job)) {
        setResult(getFailedResult(job));
        return job;
      }

      await wait(pollIntervalMs);
    }

    throw new Error(timeoutMessage);
  };

  const submitJob = async (value) => {
    const validationError = validate?.(value);

    if (validationError) {
      setStatus('error');
      setResult(validationError);
      return;
    }

    setIsLoading(true);
    setStatus('submitting');
    setResult('');
    setExitCode(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequestBody(value)),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, createErrorMessage),
        );
      }

      const createdJob = await response.json();
      const jobId = getJobId(createdJob);

      if (!jobId) {
        throw new Error('The response does not contain a job ID.');
      }

      setStatus(getStatus(createdJob));

      await pollJobStatus(jobId);
    } catch (error) {
      setStatus('error');

      setResult(
        error instanceof Error
          ? error.message
          : 'An unknown error occurred.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitJob,
    checkJobStatus,
    pollJobStatus,
  };
}