import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import ValueMark from './ValueMark';

// Cleanup after each test to prevent DOM pollution
afterEach(() => {
  cleanup();
});

describe('ValueMark', () => {
  it('renders X with blue color class', () => {
    render(<ValueMark value="X" />);
    const span = screen.getByText('X');
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass('text-blue-600');
    expect(span).toHaveClass('transition-all', 'duration-300');
  });

  it('renders O with red color class', () => {
    render(<ValueMark value="O" />);
    const span = screen.getByText('O');
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass('text-red-600');
    expect(span).toHaveClass('transition-all', 'duration-300');
  });

//   it('renders empty string when value is empty', () => {
//     render(<ValueMark value="" />);
//     const span = screen.getAllByText('');
//     expect(span).toBeInTheDocument();
//     expect(span).not.toHaveClass('text-blue-600', 'text-red-600');
//   });

//   it('renders nothing when value is undefined', () => {
//     render(<ValueMark />);
//     const span = screen.getAllByText('generic', { name: '' });
//     expect(span).toBeInTheDocument();
//     expect(span).not.toHaveClass('text-blue-600', 'text-red-600');
//   });
});