import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders placeholder heading', () => {
  render(<App />);
  const heading = screen.getByText(/Placeholder App/i);
  expect(heading).toBeDefined();
});
