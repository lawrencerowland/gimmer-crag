import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders example app heading', () => {
  render(<App />);
  const heading = screen.getByText(/Example App/i);
  expect(heading).toBeDefined();
});
