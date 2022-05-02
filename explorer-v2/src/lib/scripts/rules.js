import { Linter } from 'eslint';
import pluginReact from 'eslint-plugin-react';

const linter = new Linter();

export const categories = [
	{
		test: ({ rule }) => rule.meta.type === 'problem',
		title: 'Possible Errors',
		rules: []
	},
	{
		test: ({ rule }) => rule.meta.type === 'suggestion',
		title: 'Suggestions',
		rules: []
	},
	{
		test: ({ rule }) => rule.meta.type === 'layout',
		title: 'Layout & Formatting',
		rules: []
	},
	{
		test: ({ ruleId }) => ruleId.startsWith('react/'),
		title: 'eslint-plugin-react',
		rules: []
	}
];
export const DEFAULT_RULES_CONFIG = {};

const rules = [];
for (const [ruleId, rule] of linter.getRules()) {
	if (rule.meta.deprecated) {
		continue;
	}
	const data = {
		ruleId,
		rule,
		url: rule.meta.docs.url
	};
	rules.push(data);
	categories.find((c) => c.test(data)).rules.push(data);

	if (rule.meta.docs.recommended) {
		DEFAULT_RULES_CONFIG[ruleId] = 'error';
	}
}
for (const [ruleId, rule] of Object.entries(pluginReact.rules)) {
	if (rule.meta.deprecated) {
		continue;
	}
	const data = {
		ruleId: `react/${ruleId}`,
		rule,
		url: rule.meta.docs.url
	};
	rules.push(data);
	categories.find((c) => c.test(data)).rules.push(data);

	// if (rule.meta.docs.recommended) {
	// 	DEFAULT_RULES_CONFIG[ruleId] = 'error';
	// }
}
/** get url */
export function getURL(ruleId) {
	return rules.find((data) => data.ruleId === ruleId)?.rule?.meta.docs.url ?? '';
}
