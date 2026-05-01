/**
 * Button Component Stories
 *
 * Example Storybook stories demonstrating component documentation.
 * Run: npm run storybook
 */

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { css } from '@emotion/react';
import { designSystem } from '../src/styles/design-system';

import { Button } from '../src/components/ui';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'danger'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Full width button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Default story
export const Default: Story = {
  args: {
    children: 'Click me',
    variant: 'primary',
    size: 'md',
    disabled: false,
  },
};

// Variant showcase
export const Variants: Story = {
  render: () => (
    <div css={css`display: flex; gap: 16px; flex-wrap: wrap;`}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
};

// Sizes
export const Sizes: Story = {
  render: () => (
    <div css={css`display: flex; gap: 16px; align-items: center;`}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

// States
export const States: Story = {
  render: () => (
    <div css={css`display: flex; gap: 16px; flex-wrap: wrap;`}>
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
    </div>
  ),
};

// Full Width
export const FullWidth: Story = {
  args: {
    children: 'Full Width Button',
    fullWidth: true,
  },
};

// Playground for testing all combinations
export const Playground: Story = {
  args: {
    children: 'Playground',
    variant: 'primary',
    size: 'md',
    disabled: false,
    fullWidth: false,
  },
};
