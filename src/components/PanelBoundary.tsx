import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  name: string
  children: ReactNode
}

/** Contains a crash to one panel, so the rest of the page keeps working. */
export default class PanelBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.name} panel crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="panel panel-failed" role="alert">
        <b>The {this.props.name} panel hit a problem.</b>
        <span>The rest of the page is unaffected.</span>
        <button onClick={() => this.setState({ failed: false })}>Try again</button>
      </section>
    )
  }
}
