import dagre from 'dagre'

const NODE_WIDTH = 264
const NODE_HEIGHT = 112

export function layoutRoadmap(nodes = [], edges = []) {
  const validKeys = new Set(nodes.map((node) => node.node_key))
  const graph = new dagre.graphlib.Graph({ multigraph: true })
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    align: 'UL',
    nodesep: 30,
    ranksep: 90,
    edgesep: 18,
    marginx: 28,
    marginy: 28,
  })

  nodes.forEach((node) => {
    graph.setNode(node.node_key, {
      width: NODE_WIDTH,
      height: node.node_type === 'phase' ? NODE_HEIGHT - 18 : NODE_HEIGHT,
    })
  })

  const seen = new Set()
  edges.forEach((edge, index) => {
    if (!validKeys.has(edge.source) || !validKeys.has(edge.target)) return
    const key = `${edge.source}->${edge.target}`
    if (seen.has(key)) return
    seen.add(key)
    graph.setEdge(edge.source, edge.target, {}, `edge-${index}`)
  })

  dagre.layout(graph)

  return nodes.map((node) => {
    const point = graph.node(node.node_key)
    return {
      ...node,
      position: {
        x: (point?.x || 0) - NODE_WIDTH / 2,
        y: (point?.y || 0) - NODE_HEIGHT / 2,
      },
    }
  })
}

export const NODE_SIZE = { width: NODE_WIDTH, height: NODE_HEIGHT }
