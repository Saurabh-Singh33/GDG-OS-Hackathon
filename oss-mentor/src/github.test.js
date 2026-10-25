import {
  parseRepoUrl,
  parseIssueUrl,
  fetchReadme,
  fetchTree,
  fetchIssue,
} from './github.js';

async function runTests() {
  console.log('--- Testing parseRepoUrl ---');
  console.log('1. https://github.com/facebook/react ->', parseRepoUrl('https://github.com/facebook/react'));
  console.log('2. github.com/facebook/react ->', parseRepoUrl('github.com/facebook/react'));
  console.log('3. facebook/react ->', parseRepoUrl('facebook/react'));

  console.log('\n--- Testing parseIssueUrl ---');
  console.log('1. https://github.com/firstcontributions/first-contributions/issues/1 ->', parseIssueUrl('https://github.com/firstcontributions/first-contributions/issues/1'));
  console.log('2. firstcontributions/first-contributions/issues/1 ->', parseIssueUrl('firstcontributions/first-contributions/issues/1'));

  console.log('\n--- Testing fetchReadme ("facebook", "react") ---');
  try {
    const readme = await fetchReadme('facebook', 'react');
    console.log('fetchReadme success! Length:', readme.length, 'First 100 chars:', JSON.stringify(readme.slice(0, 100)));
  } catch (err) {
    console.error('fetchReadme error:', err.message);
  }

  console.log('\n--- Testing fetchTree ("facebook", "react") ---');
  try {
    const tree = await fetchTree('facebook', 'react');
    console.log('fetchTree success! Total blobs fetched (max 200):', tree.length);
    console.log('Sample file paths:', tree.slice(0, 5));
  } catch (err) {
    console.error('fetchTree error:', err.message);
  }

  console.log('\n--- Testing fetchIssue ("firstcontributions", "first-contributions", 1) ---');
  try {
    const issue = await fetchIssue('firstcontributions', 'first-contributions', 1);
    console.log('fetchIssue success!');
    console.log('Title:', issue.title);
    console.log('Labels:', issue.labels);
    console.log('Body length:', issue.body?.length);
  } catch (err) {
    console.error('fetchIssue error:', err.message);
  }
}

runTests();
