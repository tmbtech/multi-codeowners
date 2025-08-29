// Jest test setup file
// This file is run before each test suite

// Mock GitHub Actions core functions to prevent actual GitHub API calls during testing
jest.mock('@actions/core');
jest.mock('@actions/github');

// Set up environment variables for testing
process.env.GITHUB_TOKEN = 'mock-token';
process.env.GITHUB_REPOSITORY = 'owner/repo';
process.env.GITHUB_EVENT_NAME = 'pull_request';
