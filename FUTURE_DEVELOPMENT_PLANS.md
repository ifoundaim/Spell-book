# Future Development Plans

This document outlines planned features and enhancements for the Spellbook application.

## Spell Animation Feature

### Overview
Add an interactive spell casting animation feature that allows users to view animated spell effects directly within the spellbook interface.

### Description
Each spell card will include a "Cast" button that, when clicked, opens a modal window or overlay inside the spellbook. This window will display and play a video animation of the spell being cast, providing a visual representation of the spell's effects.

### Technical Considerations
- **Video Storage**: Determine how spell animation videos will be stored (local files, CDN, embedded URLs in spell data)
- **Modal/Overlay Component**: Create a modal component that fits the grimoire aesthetic
- **Video Player**: Implement a custom or styled video player that matches the spellbook theme
- **Data Model**: Extend the Spell data model to include an optional `animationUrl` or `videoUrl` field
- **Performance**: Consider lazy loading videos and implementing loading states
- **Accessibility**: Ensure the modal and video player are keyboard accessible and have proper ARIA labels

### UI/UX Details
- The "Cast" button should be styled to fit the grimoire aesthetic (possibly styled as a spell circle or mystical button)
- The animation window should be themed to match the spellbook's parchment/ink aesthetic
- Include controls for playing, pausing, and closing the animation window
- Optionally add sound effects that match the spell's element type

### Implementation Steps
1. Design and implement the modal/overlay component
2. Add "Cast" button to spell card rendering in `src/ui.js`
3. Create video player component with grimoire styling
4. Extend Spell data model to support animation URLs (if needed)
5. Add event handlers for opening/closing the animation window
6. Style the animation window to match the spellbook aesthetic
7. Add loading states and error handling for missing videos
