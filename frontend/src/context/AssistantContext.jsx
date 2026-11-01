import { createContext, useContext, useMemo, useState } from 'react'

const AssistantContext = createContext(null)

export function AssistantProvider({ children }) {
  const [selectedNode, setSelectedNode] = useState(null)
  const [open, setOpen] = useState(false)

  const value = useMemo(
    () => ({
      selectedNode,
      setSelectedNode,
      open,
      setOpen,
      openAssistant: (node = null) => {
        if (node) setSelectedNode(node)
        setOpen(true)
      },
    }),
    [selectedNode, open],
  )

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>
}

export function useAssistant() {
  const context = useContext(AssistantContext)
  if (!context) throw new Error('useAssistant must be used inside AssistantProvider')
  return context
}
