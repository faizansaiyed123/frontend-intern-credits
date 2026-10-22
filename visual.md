# Mintline — Credit Management Workspace

A guided look at how Mintline brings account balances and credit operations into one focused workspace.

The experience follows a simple journey: open an existing account, review its current balance, make a controlled change, and see the updated value returned by the connected service.

## At a glance

| Action | Balance shown in this walkthrough |
| --- | ---: |
| Starting balance | 120 credits |
| Add 25 credits | 145 credits |
| Deduct 40 credits | 105 credits |
| Reset balance | 0 credits |

## The product journey

## 1. Start with a clear workspace

### Welcome to Mintline

![Welcome to Mintline](docs/walkthrough/visuals/01-homepage.png)

The homepage introduces a focused credit-management workspace and takes you directly to the dashboard.

## 2. Review an account balance

### Credit overview

![Credit overview](docs/walkthrough/visuals/02-credit-overview.png)

Open an existing account to see its current balance, account ID, and last-updated time. The values are requested from the connected credit service.

## 3. Add credits

### Add credits

![Add credits](docs/walkthrough/visuals/03-add-credits.png)

Choose an amount and confirm the operation. Mintline submits the change through the credit API.

### Balance after addition

![Balance after addition](docs/walkthrough/visuals/04-balance-after-addition.png)

The updated balance is shown after the service completes the operation: 120 credits becomes 145 after adding 25.

## 4. Deduct credits

### Deduct credits

![Deduct credits](docs/walkthrough/visuals/05-deduct-credits.png)

Deduct an amount from the available balance. The interface helps keep the requested deduction within the current balance, and the service enforces the balance rule as well.

### Balance after deduction

![Balance after deduction](docs/walkthrough/visuals/06-balance-after-deduction.png)

After deducting 40 credits, the account balance is 105.

## 5. Reset a balance deliberately

### Reset confirmation

![Reset confirmation](docs/walkthrough/visuals/07-reset-confirmation.png)

Reset is a distinct action and requires an explicit confirmation before it is submitted.

### Balance after reset

![Balance after reset](docs/walkthrough/visuals/08-balance-after-reset.png)

The account reflects the reset balance of zero once the service returns the updated record.

## 6. View schema migration history

### Migration history

![Migration history](docs/walkthrough/visuals/09-migration-history.png)

The administrator area can retrieve recorded schema changes from the service. Access is protected by the backend's configured administrator key.

## 7. Use the workspace on mobile

### Mobile dashboard

![Mobile dashboard](docs/walkthrough/visuals/10-mobile-dashboard.png)

The dashboard remains readable at a narrow viewport, with the same account balance coming from the connected service.

### Mobile navigation

![Mobile navigation](docs/walkthrough/visuals/11-mobile-navigation.png)

Navigation adapts for a smaller screen so the main workspace remains reachable.

## One connected source of truth

Balances are requested from the connected FastAPI service. Add, deduct, and reset actions are sent to that service, and the dashboard reflects the account record returned after each operation.

## Explore the code

- [Mintline frontend](https://github.com/faizansaiyed123/frontend-intern-credits)
- [Credit management backend](https://github.com/faizansaiyed123/backend-intern-credits)
