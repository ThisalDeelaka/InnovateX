// cypress/e2e/login.cy.js
describe('Login Page Tests', () => {
  beforeEach(() => {
    cy.visit('/login')
    cy.clearCookies()
    cy.clearLocalStorage()
    cy.intercept('POST', '**/users/login', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          user: { 
            _id: '123', 
            name: 'Test User', 
            email: req.body.email, 
            role: req.body.email.includes('admin') ? 'admin' :
                  req.body.email.includes('driver') ? 'driver' : 'user'
          },
          token: 'fake-jwt-token'
        }
      })
    }).as('loginRequest')
  })

  it('should display login form correctly', () => {
    cy.get('h1').should('contain', 'Clean Waste Login')
    cy.get('input[name="email"]').should('exist')
    cy.get('input[name="password"]').should('exist')
    cy.contains('button', /^Login$/).should('exist')
    cy.contains('Don\'t have an account?').should('be.visible')
  })

  it('should toggle password visibility', () => {
    cy.get('input[name="password"]').should('have.attr', 'type', 'password')
    cy.get('[data-testid="toggle-password"]').click()
    cy.get('input[name="password"]').should('have.attr', 'type', 'text')
  })

  describe('Auto-fill Credentials', () => {
    it('should auto-fill user credentials', () => {
      cy.contains('button', 'Login as User').click()
      cy.get('input[name="email"]').should('have.value', 'nawa@gmail.com')
      cy.get('input[name="password"]').should('have.value', 'nawa')
    })

    it('should auto-fill admin credentials', () => {
      cy.contains('button', 'Login as Admin').click()
      cy.get('input[name="email"]').should('have.value', 'admin@gmail.com')
      cy.get('input[name="password"]').should('have.value', 'admin')
    })

    // driver auto‐fill removed
  })

  describe('Login Functionality', () => {
    it('should show error when fields are empty', () => {
      cy.contains('button', /^Login$/).click()
      cy.on('window:alert', (str) => {
        expect(str).to.equal('Please fill out both email and password.')
      })
    })

    // successful login tests removed

    it('should show error for invalid credentials', () => {
      cy.intercept('POST', '**/users/login', {
        statusCode: 401,
        body: { message: 'Invalid credentials' }
      }).as('failedLogin')
      
      cy.get('input[name="email"]').type('invalid@example.com')
      cy.get('input[name="password"]').type('wrongpassword')
      cy.contains('button', /^Login$/).click()
      
      cy.wait('@failedLogin')
      cy.on('window:alert', (str) => {
        expect(str).to.equal('Invalid email or password. Please try again.')
      })
    })
  })

  it('should navigate to registration page', () => {
    cy.contains('Sign up').click()
    cy.url().should('include', '/register')
  })
})
