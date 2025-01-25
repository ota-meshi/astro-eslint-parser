/* eslint 
  camelcase: 0,
  no-console: 0,
  jsdoc/require-jsdoc: 0
  ---
  This file is used to post pull request comments on how to use the package published with `npx pkg-pr-new publish`.
  */
export default async function ({ github, context, output }) {
  console.log("pkg-pr-new publish output:", JSON.stringify(output));

  const sha =
    context.event_name === "pull_request"
      ? context.payload.pull_request.head.sha
      : context.payload.after;
  const commitUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${sha}`;

  const pullRequestNumber = await getPullRequestNumber();

  const packages = output.packages.map((p) => {
    const normalizedUrl =
      pullRequestNumber && p.url.endsWith(sha)
        ? `${p.url.slice(0, -sha.length)}${pullRequestNumber}`
        : p.url;
    return {
      name: p.name,
      url: normalizedUrl,
    };
  });

  const botCommentIdentifier = "<!-- posted by pkg.pr.new-comment.mjs -->";

  const onlineUrl = new URL(
    "https://eslint-online-playground.netlify.app/#eslint-plugin-astro",
  );
  const overrideDeps = {};
  for (const p of packages) {
    overrideDeps[p.name] = p.url;
  }
  onlineUrl.searchParams.set("overrideDeps", JSON.stringify(overrideDeps));
  const body = `${botCommentIdentifier}

## Install This PR Locally

\`\`\`
npm i ${packages.map((p) => p.url).join(" ")}
\`\`\`

## Try This PR Online

[ESLint Online Playground](${onlineUrl})

## Published Packages:

${packages.map((p) => `- ${p.name}: ${p.url}`).join("\n")}

[View Commit](${commitUrl})`;

  if (pullRequestNumber) {
    await createOrUpdateComment(pullRequestNumber);
  }

  async function getPullRequestNumber() {
    if (context.eventName === "pull_request") {
      if (context.issue.number) {
        return context.issue.number;
      }
    } else if (context.eventName === "push") {
      const pullRequests = await github.rest.pulls.list({
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: "open",
        head: `${context.repo.owner}:${context.ref.replace("refs/heads/", "")}`,
      });

      if (pullRequests.data.length > 0) {
        return pullRequests.data[0].number;
      }
      console.log(
        "No open pull request found for this push. Logging publish information to console:",
      );
      logPublishInfo();
    }
    return null;
  }

  async function findBotComment(issueNumber) {
    if (!issueNumber) return null;
    const comments = await github.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
    });
    return comments.data.find((comment) =>
      comment.body.includes(botCommentIdentifier),
    );
  }

  async function createOrUpdateComment(issueNumber) {
    if (!issueNumber) {
      console.log("No issue number provided. Cannot post or update comment.");
      return;
    }

    const existingComment = await findBotComment(issueNumber);
    if (existingComment) {
      await github.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existingComment.id,
        body,
      });
    } else {
      await github.rest.issues.createComment({
        issue_number: issueNumber,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body,
      });
    }
  }

  function logPublishInfo() {
    console.log(`\n${"=".repeat(50)}`);
    console.log("Publish Information");
    console.log("=".repeat(50));
    console.log("\nPublished Packages:");
    console.log(output.packages.map((p) => `- ${p.name}: ${p.url}`).join("\n"));
    console.log(`\nCommit URL: ${commitUrl}`);
    console.log(`\n${"=".repeat(50)}`);
  }
}
