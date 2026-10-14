// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PanelBoundary from './PanelBoundary'

afterEach(cleanup)

it('contains a crash to its panel and can retry', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let broken = true
  function Flaky() {
    if (broken) throw new Error('boom')
    return <p>working</p>
  }
  render(
    <>
      <PanelBoundary name="map">
        <Flaky />
      </PanelBoundary>
      <p>neighbour</p>
    </>,
  )
  expect(screen.getByRole('alert').textContent).toContain('The map panel hit a problem')
  expect(screen.getByText('neighbour')).toBeTruthy()

  broken = false
  fireEvent.click(screen.getByText('Try again'))
  expect(screen.getByText('working')).toBeTruthy()
})
