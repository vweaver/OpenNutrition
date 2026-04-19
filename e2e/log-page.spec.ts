import { test, expect } from '@playwright/test';

test('log page tabs are switchable and functional', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Loading OpenNutrition...')).toBeHidden({ timeout: 15_000 });

	// Navigate to log page via a meal's Add Food link
	await page.getByText('Add Food').first().click();
	await expect(page.getByRole('heading', { name: 'Log Food' })).toBeVisible();

	// Should start on Search tab
	const searchTab = page.getByRole('button', { name: 'Search' });
	const scanTab = page.getByRole('button', { name: 'Scan Label' });
	const quickTab = page.getByRole('button', { name: 'Quick Add' });
	const recentTab = page.getByRole('button', { name: 'Recent' });

	await expect(searchTab).toBeVisible();
	await expect(scanTab).toBeVisible();
	await expect(quickTab).toBeVisible();
	await expect(recentTab).toBeVisible();

	// Switch to Quick Add — should show filter input and log button
	await quickTab.click();
	await expect(page.getByPlaceholder('Filter foods...')).toBeVisible();
	await expect(page.getByText('Select foods to log')).toBeVisible();

	// Switch to Recent — should show log button
	await recentTab.click();
	await expect(page.getByText('Select foods to log')).toBeVisible();

	// Switch to Scan Label — should show camera prompt
	await scanTab.click();
	await expect(page.getByText('Open Camera')).toBeVisible();

	// Switch back to Search — should show search input
	await searchTab.click();
	await expect(page.getByPlaceholder(/search/i)).toBeVisible();

	// Can navigate back to dashboard via Cancel
	await page.getByText('Cancel').click();
	await expect(page.getByText('Breakfast')).toBeVisible();
});
