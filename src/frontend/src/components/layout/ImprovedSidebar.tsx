  // Handle click outside to close sidebar on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isMobile &&
        isOverlay &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        hideSidebarOnMobile();
      }
    };

    const handleScroll = () => {
      // Prevent body scroll when sidebar is open on mobile
      if (isMobile && (isOverlay || isHidden)) {
        const scrollY = window.scrollY;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${scrollY}px`;
      } else {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    // Apply scroll prevention when sidebar state changes
    handleScroll();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Cleanup scroll prevention
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isMobile, isOverlay, isHidden, hideSidebarOnMobile]);
