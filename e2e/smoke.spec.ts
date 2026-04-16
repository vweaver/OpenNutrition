import { test, expect } from '@playwright/test';

test('app loads and shows the dashboard', async ({ page }) => {
	await page.goto('/');
	// Wait for the DB init spinner to finish
	await expect(page.getByText('Loading OpenNutrition...')).toBeHidden({ timeout: 15_000 });
	// Bottom nav should be present
	await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Weight' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Foods' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('can navigate between tabs', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Loading OpenNutrition...')).toBeHidden({ timeout: 15_000 });

	await page.getByRole('link', { name: 'Foods' }).click();
	await expect(page.getByRole('heading', { name: 'My Foods' })).toBeVisible();

	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page.getByText(/Profile/i).first()).toBeVisible();

	await page.getByRole('link', { name: 'Weight' }).click();
	await expect(page.getByText(/weight/i).first()).toBeVisible();
});

test('meal sections render on dashboard', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Loading OpenNutrition...')).toBeHidden({ timeout: 15_000 });

	await expect(page.getByText('Breakfast')).toBeVisible();
	await expect(page.getByText('Lunch')).toBeVisible();
	await expect(page.getByText('Dinner')).toBeVisible();
	await expect(page.getByText('Snack')).toBeVisible();
});
