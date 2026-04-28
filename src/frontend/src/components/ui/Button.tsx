export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const buttonCss = css`
    ${getButtonStyles(variant, size)}
    ${fullWidth && 'width: 100%;'}
    ${isLoading && 'pointer-events: none;'}
    /* Ensure minimum touch target size for accessibility */
    min-height: 44px;
    min-width: ${size === 'sm' ? '44px' : 'auto'};
    padding-left: ${size === 'sm' ? '12px' : 'inherit'};
    padding-right: ${size === 'sm' ? '12px' : 'inherit'};
  `;
