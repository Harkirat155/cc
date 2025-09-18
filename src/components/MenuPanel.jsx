import React, { useState, useRef, useEffect } from 'react';

const useWindowSize = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
};

const MenuPanel = ({ onReset, onNewGame }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const menuRef = useRef(null);
  const { width } = useWindowSize();

  // Collapse menu if width < 500px or if overlapping board (simulate with small width)
  useEffect(() => {
    if (width < 500) {
      setCollapsed(true);
      setExpanded(false);
    } else {
      setCollapsed(false);
      setExpanded(true);
    }
  }, [width]);


  // Collapse when clicking outside or on button
  useEffect(() => {
    if (!collapsed || !expanded) return;
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [collapsed, expanded]);

  // Collapse when either button is clicked in expanded/collapsed mode
  const handleButtonClick = (action) => {
    action();
    if (collapsed) setExpanded(false);
  };

  // Expand menu on click
  const handleExpand = () => {
    if (collapsed && !expanded) setExpanded(true);
  };

  return (
    <div
      ref={menuRef}
      className={`fixed left-1/2 bottom-4 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg transition-all duration-300 ${expanded ? 'p-4' : 'p-2'} z-30 border border-gray-200 dark:border-gray-700`}
      style={{ minWidth: collapsed ? '120px' : '240px', maxWidth: '100vw' }}
      onClick={handleExpand}
    >
      {collapsed && !expanded ? (
        <div className="flex items-center justify-center cursor-pointer">
          <span className="text-base font-semibold text-gray-800 dark:text-gray-100">Menu</span>
          <span className="ml-2 text-xs text-blue-500">▲</span>
        </div>
      ) : (
        <div className={`flex ${width > 600 ? 'flex-row' : 'flex-col'} gap-2 items-center justify-center w-full`}>
          <div className="flex gap-2 items-center justify-center w-full">
            <button
              className={`py-2 px-6 min-w-[120px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200 border border-gray-300 dark:border-gray-600 whitespace-nowrap text-center ${width > 600 ? 'rounded-r-none' : 'mb-2'}`}
              style={width > 600 ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 } : {}}
              onClick={(e) => { e.stopPropagation(); handleButtonClick(onNewGame); }}
            >
              <span className="px-2 whitespace-nowrap">New Game</span>
            </button>
            <button
              className={`py-2 px-6 min-w-[120px] bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 border border-gray-300 dark:border-gray-600 whitespace-nowrap text-center ${width > 600 ? 'rounded-l-none' : 'mb-2'}`}
              style={width > 600 ? { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 } : {}}
              onClick={(e) => { e.stopPropagation(); handleButtonClick(onReset); }}
            >
              <span className="px-2 whitespace-nowrap">Reset Score</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPanel;
