import { useState } from 'react'
import FinanceLandingPage from "./FinanceLandingPage.jsx"
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  return <FinanceLandingPage />
}

export default App
