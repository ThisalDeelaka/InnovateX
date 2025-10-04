// cypress/e2e/wasteTypeSelection.cy.js
describe('Waste Type Selection Page', () => {
    beforeEach(() => {
      // make sure this matches your React Router path
      cy.visit('/waste-type-selection')                
      cy.clearCookies()
      cy.clearLocalStorage()
    })
  
    it('starts with zero selected and alerts on Next', () => {
      // 1) Verify the counter shows “0 waste types selected”
      cy.contains('p', '0 waste types selected')
  
      // 2) Stub window.alert *before* clicking Next
      cy.on('window:alert', (msg) => {
        expect(msg).to.equal('Please select at least one waste type.')
      })
  
      // 3) Click Next and assert the alert fires
      cy.contains('button', 'Next').click()
    })
  
    it('toggles selection styling when clicking a waste type', () => {
      cy.contains('button', 'Organic Waste')
        .should('have.class', 'bg-white')               // un‑selected state
        .click()
        .should('have.class', 'bg-[#175E5E]')           // selected state
        .click()
        .should('have.class', 'bg-white')               // back to un‑selected
    })
  
    it('navigates to sorting-guidelines with correct state', () => {
      // pick two types…
      cy.contains('button', 'Organic Waste').click()
      cy.contains('button', 'Paper Waste').click()
  
      // click Next
      cy.contains('button', 'Next').click()
  
      // assert URL changed
      cy.location('pathname').should('eq', '/sorting-guidelines')
  
      // assert we passed the right state
      cy.window()
        .its('history.state.state.selectedWasteTypes')
        .should('deep.equal', ['Organic Waste', 'Paper Waste'])
    })
  })
  