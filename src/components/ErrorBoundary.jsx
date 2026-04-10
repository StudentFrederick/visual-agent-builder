import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-8 bg-red-50 text-red-800 h-screen overflow-auto">
          <h1 className="text-xl font-bold mb-4">Something crashed</h1>
          <pre className="text-sm whitespace-pre-wrap bg-white p-4 rounded border border-red-200">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
            onClick={() => {
              localStorage.removeItem('vab_flow')
              window.location.reload()
            }}
          >
            Clear flow & reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
