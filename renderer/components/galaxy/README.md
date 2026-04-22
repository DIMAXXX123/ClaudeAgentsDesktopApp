# Memory Galaxy Components

## Files Created

### MemoryGalaxy3D.tsx
- React Three Fiber 3D visualization of memory nodes
- Fruchterman-Reingold force-directed layout in 3D
- Interactive sphere nodes with hover/select states
- Edge rendering with transparency
- StarField background
- OrbitControls for mouse navigation (drag rotate, scroll zoom)
- Props: `nodes`, `edges`, `onSelectNode`, `selectedId`
- Uses same NODE_COLOR palette as 2D graph

### MemoryGalaxyTabs.tsx
- Tab switcher component (Graph 2D | Timeline | Galaxy 3D)
- Lazy-loads MemoryGalaxy3D with dynamic import + Suspense
- Integrates PlanetDetail side panel for 3D view
- Main entry point for /galaxy page

### MemoryGalaxyTimeline.tsx
- Placeholder for future timeline visualization
- Shows memory statistics and "coming soon" message

### PlanetDetail.tsx
- Side panel for 3D view showing selected node details
- Displays: name, type, description, ID, degree, size, tags
- "Open in 2D Graph" button to switch to 2D view with same node selected
- Matches dark theme styling

## Dependencies Installed

```json
{
  "three": "^0.184.0",
  "@react-three/fiber": "^9.6.0",
  "@react-three/drei": "^10.7.7",
  "@types/three": "^0.184.0"
}
```

## Integration Points

1. `/app/galaxy/page.tsx` - Updated to use MemoryGalaxyTabs instead of MemoryGalaxy
2. Maintains backward compatibility with existing 2D MemoryGalaxy component
3. Uses existing NODE_COLOR palette from `@/lib/memoryGalaxy`

## Performance Notes

- Force layout calculation happens once in useMemo on component mount
- 100 iterations max (scales down for large node counts)
- Edge rendering via THREE.Line imperative API (better performance than JSX)
- Suspense boundary prevents blocking main UI during 3D load

## TODO / Future Improvements

- For 500+ nodes: switch to InstancedMesh for better performance
- Mobile detection: fallback warning for non-desktop
- Physics simulation could use web-worker for smooth animation
- Timeline tab needs full implementation with heatmap
- Could add animation on node selection (camera zoom)
