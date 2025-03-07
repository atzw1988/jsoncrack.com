import React from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { toast } from "react-hot-toast";
import { Space } from "react-zoomable-ui";
import { ElkRoot } from "reaflow/dist/layout/useLayout";
import { useLongPress } from "use-long-press";
import { CustomNode } from "src/containers/Views/GraphView/CustomNode";
import { ViewMode } from "src/enums/viewMode.enum";
import useToggleHide from "src/hooks/useToggleHide";
import { Loading } from "src/layout/Loading";
import useConfig from "src/store/useConfig";
import useGraph from "src/store/useGraph";
import useUser from "src/store/useUser";
import { NodeData } from "src/types/graph";
import { CustomEdge } from "./CustomEdge";
import { ErrorView } from "./ErrorView";
import { PremiumView } from "./PremiumView";

const Canvas = dynamic(() => import("reaflow").then(r => r.Canvas), {
  ssr: false,
});

interface GraphProps {
  isWidget?: boolean;
}

const StyledEditorWrapper = styled.div<{ $widget: boolean; $showRulers: boolean }>`
  position: absolute;
  width: 100%;
  height: ${({ $widget }) => ($widget ? "calc(100vh - 40px)" : "calc(100vh - 67px)")};

  --bg-color: ${({ theme }) => theme.GRID_BG_COLOR};
  --line-color-1: ${({ theme }) => theme.GRID_COLOR_PRIMARY};
  --line-color-2: ${({ theme }) => theme.GRID_COLOR_SECONDARY};

  background-color: var(--bg-color);
  ${({ $showRulers }) =>
    $showRulers &&
    `
    background-image: linear-gradient(var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(90deg, var(--line-color-1) 1.5px, transparent 1.5px),
      linear-gradient(var(--line-color-2) 1px, transparent 1px),
      linear-gradient(90deg, var(--line-color-2) 1px, transparent 1px);
    background-position:
      -1.5px -1.5px,
      -1.5px -1.5px,
      -1px -1px,
      -1px -1px;
    background-size:
      100px 100px,
      100px 100px,
      20px 20px,
      20px 20px;
  `};

  .jsoncrack-space {
    cursor: url("/assets/cursor.svg"), auto;
  }

  :active {
    cursor: move;
  }

  .dragging,
  .dragging button {
    pointer-events: none;
  }

  rect {
    fill: ${({ theme }) => theme.BACKGROUND_NODE};
  }

  @media only screen and (max-width: 768px) {
    height: ${({ $widget }) => ($widget ? "calc(100vh - 40px)" : "100vh")};
  }

  @media only screen and (max-width: 320px) {
    height: 100vh;
  }
`;

const layoutOptions = {
  "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
};

const PREMIUM_LIMIT = 200;
const ERROR_LIMIT_TREE = 5_000;
const ERROR_LIMIT = 10_000;

const GraphCanvas = ({ isWidget }: GraphProps) => {
  const { validateHiddenNodes } = useToggleHide();
  const setLoading = useGraph(state => state.setLoading);
  const centerView = useGraph(state => state.centerView);
  const direction = useGraph(state => state.direction);
  const nodes = useGraph(state => state.nodes);
  const edges = useGraph(state => state.edges);

  const [paneWidth, setPaneWidth] = React.useState(2000);
  const [paneHeight, setPaneHeight] = React.useState(2000);

  const onLayoutChange = React.useCallback(
    (layout: ElkRoot) => {
      if (layout.width && layout.height) {
        const areaSize = layout.width * layout.height;
        const changeRatio = Math.abs((areaSize * 100) / (paneWidth * paneHeight) - 100);

        setPaneWidth(layout.width + 50);
        setPaneHeight((layout.height as number) + 50);

        setTimeout(() => {
          validateHiddenNodes();
          window.requestAnimationFrame(() => {
            if (changeRatio > 70 || isWidget) centerView();
            setLoading(false);
          });
        });
      }
    },
    [isWidget, paneHeight, paneWidth, centerView, setLoading, validateHiddenNodes]
  );

  return (
    <Canvas
      className="jsoncrack-canvas"
      onLayoutChange={onLayoutChange}
      node={p => <CustomNode {...p} />}
      edge={p => <CustomEdge {...p} />}
      nodes={nodes}
      edges={edges}
      maxHeight={paneHeight}
      maxWidth={paneWidth}
      height={paneHeight}
      width={paneWidth}
      direction={direction}
      layoutOptions={layoutOptions}
      key={direction}
      pannable={false}
      zoomable={false}
      animated={false}
      readonly={true}
      dragEdge={null}
      dragNode={null}
      fit={true}
    />
  );
};

function getViewType(nodes: NodeData[]) {
  if (nodes.length > ERROR_LIMIT) return "error";
  if (nodes.length > ERROR_LIMIT_TREE) return "tree";
  if (nodes.length > PREMIUM_LIMIT) return "premium";
  return "graph";
}

export const Graph = ({ isWidget = false }: GraphProps) => {
  const setViewPort = useGraph(state => state.setViewPort);
  const loading = useGraph(state => state.loading);
  const isPremium = useUser(state => state.premium);
  const viewType = useGraph(state => getViewType(state.nodes));
  const gesturesEnabled = useConfig(state => state.gesturesEnabled);
  const rulersEnabled = useConfig(state => state.rulersEnabled);
  const setViewMode = useConfig(state => state.setViewMode);

  const callback = React.useCallback(() => {
    const canvas = document.querySelector(".jsoncrack-canvas") as HTMLDivElement | null;
    canvas?.classList.add("dragging");
  }, []);

  const bindLongPress = useLongPress(callback, {
    threshold: 150,
    onFinish: () => {
      const canvas = document.querySelector(".jsoncrack-canvas") as HTMLDivElement | null;
      canvas?.classList.remove("dragging");
    },
  });

  const blurOnClick = React.useCallback(() => {
    if ("activeElement" in document) (document.activeElement as HTMLElement)?.blur();
  }, []);

  if (viewType === "error") {
    return <ErrorView />;
  }

  if (viewType === "tree") {
    setViewMode(ViewMode.Tree);
    toast("This document is too large to display as a graph. Switching to tree view.");
  }

  // if (viewType === "premium" && !isWidget) {
  //   if (!isPremium) return <PremiumView />;
  // }

  return (
    <>
      <Loading loading={loading} message="Painting graph..." />
      <StyledEditorWrapper
        $widget={isWidget}
        onContextMenu={e => e.preventDefault()}
        onClick={blurOnClick}
        key={String(gesturesEnabled)}
        $showRulers={rulersEnabled}
        {...bindLongPress()}
      >
        <Space
          onCreate={setViewPort}
          onContextMenu={e => e.preventDefault()}
          treatTwoFingerTrackPadGesturesLikeTouch={gesturesEnabled}
          pollForElementResizing
          className="jsoncrack-space"
        >
          <GraphCanvas isWidget={isWidget} />
        </Space>
      </StyledEditorWrapper>
    </>
  );
};
