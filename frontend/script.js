const API_URL = "http://127.0.0.1:8000";

// =====================================================
// KAIRO - Frontend JavaScript
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeVoting();
    initializeSaving();
    initializeTabs();
    initializeSearch();
    initializeCommunityButtons();
    initializeMusic();
    initializeComments();
    initializeCreatePost();

    loadPosts();
});


// =====================================================
// LOAD POSTS FROM DATABASE
// =====================================================

async function loadPosts() {
    try {
        const response = await fetch(`${API_URL}/api/posts`);

        if (!response.ok) {
            throw new Error("Failed to load posts");
        }

        const posts = await response.json();

        const feed = document.querySelector(".feed");

        if (!feed) return;

        feed.querySelectorAll(".database-post").forEach(post => {
            post.remove();
        });

        const tabs = feed.querySelector(".feed-tabs");

        posts.forEach(post => {
            const postElement = createPostElement(post);

            if (tabs) {
                tabs.insertAdjacentElement("afterend", postElement);
            } else {
                feed.appendChild(postElement);
            }
        });

        initializeVoting();
        initializeSaving();
        initializeComments();

    } catch (error) {
        console.error("Could not load KAIRO posts:", error);
    }
}


// =====================================================
// CREATE DATABASE POST ELEMENT
// =====================================================

function createPostElement(post) {
    const article = document.createElement("article");

    article.className = "post-card database-post";
    article.dataset.postId = post.id;

    const communityIcon = getCommunityIcon(post.community);

    article.innerHTML = `
        <div class="post-top">
            <div class="post-community">
                <div class="post-community-icon">
                    ${communityIcon}
                </div>

                <div class="post-community-info">
                    <strong>${escapeHTML(post.community)}</strong>
                    <span>@${escapeHTML(post.username)} · just now</span>
                </div>
            </div>

            <button class="post-menu" aria-label="Post menu">•••</button>
        </div>

        <div class="post-content">
            <h2>${escapeHTML(post.title)}</h2>

            ${
                post.content
                    ? `<p>${escapeHTML(post.content)}</p>`
                    : ""
            }
        </div>

        <div class="post-tags">
            <span>#${escapeHTML(post.community.toLowerCase())}</span>
        </div>

        <div class="post-actions">

            <div class="vote-group">
                <button class="vote-button upvote" aria-label="Upvote">
                    ▲
                </button>

                <span class="vote-count">${post.votes || 0}</span>

                <button class="vote-button downvote" aria-label="Downvote">
                    ▼
                </button>
            </div>

            <button class="post-action comment-button">
                💬
                <span class="comment-count">0</span>
            </button>

            <button class="post-action save-button">
                🔖
                <span>Save</span>
            </button>

            <button class="post-action share-button">
                ↗
                <span>Share</span>
            </button>

        </div>
    `;

    return article;
}


// =====================================================
// COMMUNITY ICONS
// =====================================================

function getCommunityIcon(community) {
    const icons = {
        Movies: "🎬",
        Music: "🎵",
        Gaming: "🎮",
        Anime: "🌸",
        Memes: "😂"
    };

    return icons[community] || "✦";
}


// =====================================================
// VOTING
// =====================================================

function initializeVoting() {
    document.querySelectorAll(".post-card").forEach(post => {

        const upvote = post.querySelector(".upvote");
        const downvote = post.querySelector(".downvote");
        const voteCount = post.querySelector(".vote-count");

        if (!upvote || !downvote || !voteCount) return;

        if (upvote.dataset.initialized === "true") return;

        upvote.dataset.initialized = "true";
        downvote.dataset.initialized = "true";


        // ---------- UPVOTE ----------

        upvote.addEventListener("click", async () => {

            const postId = post.dataset.postId;

            // Static prototype posts still work locally
            if (!postId) {
                let count = parseInt(voteCount.textContent) || 0;

                if (upvote.classList.contains("voted")) {
                    count--;
                    upvote.classList.remove("voted");
                } else {
                    if (downvote.classList.contains("voted")) {
                        count++;
                        downvote.classList.remove("voted");
                    }

                    count++;
                    upvote.classList.add("voted");
                }

                voteCount.textContent = count;
                return;
            }


            let change = 1;

            if (upvote.classList.contains("voted")) {
                change = -1;
            } else if (downvote.classList.contains("voted")) {
                change = 2;
            }


            await sendVote(postId, change, voteCount, upvote, downvote);
        });


        // ---------- DOWNVOTE ----------

        downvote.addEventListener("click", async () => {

            const postId = post.dataset.postId;

            // Static prototype posts still work locally
            if (!postId) {
                let count = parseInt(voteCount.textContent) || 0;

                if (downvote.classList.contains("voted")) {
                    count++;
                    downvote.classList.remove("voted");
                } else {
                    if (upvote.classList.contains("voted")) {
                        count--;
                        upvote.classList.remove("voted");
                    }

                    count--;
                    downvote.classList.add("voted");
                }

                voteCount.textContent = count;
                return;
            }


            let change = -1;

            if (downvote.classList.contains("voted")) {
                change = 1;
            } else if (upvote.classList.contains("voted")) {
                change = -2;
            }


            await sendVote(postId, change, voteCount, upvote, downvote);
        });
    });
}


// =====================================================
// SEND VOTE TO BACKEND
// =====================================================

async function sendVote(
    postId,
    change,
    voteCount,
    upvote,
    downvote
) {

    // The API currently accepts only +1 or -1.
    // For switching directly from upvote to downvote,
    // we perform the operation twice.

    try {

        if (Math.abs(change) === 2) {

            const firstChange = change > 0 ? 1 : -1;
            const secondChange = firstChange;

            await sendSingleVote(postId, firstChange);
            const result = await sendSingleVote(postId, secondChange);

            voteCount.textContent = result.votes;

        } else {

            const result = await sendSingleVote(postId, change);

            voteCount.textContent = result.votes;
        }


        // Update button state

        if (change > 0) {
            upvote.classList.add("voted");
            downvote.classList.remove("voted");
        } else {
            downvote.classList.add("voted");
            upvote.classList.remove("voted");
        }

        // If user clicked the already active button,
        // remove its active state.
        if (
            (change === -1 && downvote.classList.contains("was-voted")) ||
            (change === 1 && upvote.classList.contains("was-voted"))
        ) {
            upvote.classList.remove("voted");
            downvote.classList.remove("voted");
        }

    } catch (error) {
        console.error("Vote failed:", error);
        alert("Could not update vote.");
    }
}


// =====================================================
// SINGLE VOTE REQUEST
// =====================================================

async function sendSingleVote(postId, change) {

    const response = await fetch(
        `${API_URL}/api/posts/${postId}/vote`,
        {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                change: change
            })
        }
    );

    if (!response.ok) {
        throw new Error("Vote request failed");
    }

    return await response.json();
}


// =====================================================
// SAVE POSTS
// =====================================================

function initializeSaving() {
    document.querySelectorAll(".save-button").forEach(button => {

        if (button.dataset.initialized === "true") return;

        button.dataset.initialized = "true";

        button.addEventListener("click", () => {

            button.classList.toggle("saved");

            const text = button.querySelector("span");

            if (text) {
                text.textContent =
                    button.classList.contains("saved")
                        ? "Saved"
                        : "Save";
            }
        });
    });
}


// =====================================================
// FEED TABS
// =====================================================

function initializeTabs() {

    document.querySelectorAll(".feed-tab").forEach(tab => {

        if (tab.dataset.initialized === "true") return;

        tab.dataset.initialized = "true";

        tab.addEventListener("click", () => {

            document.querySelectorAll(".feed-tab")
                .forEach(item => {
                    item.classList.remove("active");
                });

            tab.classList.add("active");

            console.log(
                "KAIRO feed:",
                tab.textContent.trim()
            );
        });
    });
}


// =====================================================
// SEARCH
// =====================================================

function initializeSearch() {

    const searchInput =
        document.getElementById("searchInput");

    if (!searchInput) return;

    if (searchInput.dataset.initialized === "true") return;

    searchInput.dataset.initialized = "true";

    searchInput.addEventListener("input", () => {

        const query =
            searchInput.value.toLowerCase().trim();

        document.querySelectorAll(".post-card")
            .forEach(post => {

                const text =
                    post.textContent.toLowerCase();

                post.style.display =
                    text.includes(query)
                        ? ""
                        : "none";
            });
    });
}


// =====================================================
// COMMUNITY JOIN BUTTONS
// =====================================================

function initializeCommunityButtons() {

    document.querySelectorAll(".join-button")
        .forEach(button => {

            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";

            button.addEventListener("click", () => {

                if (button.classList.contains("joined")) {

                    button.classList.remove("joined");
                    button.textContent = "Join";

                } else {

                    button.classList.add("joined");
                    button.textContent = "Joined";
                }
            });
        });
}


// =====================================================
// MUSIC PLAYER
// =====================================================

function initializeMusic() {

    document.querySelectorAll(".music-play")
        .forEach(button => {

            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";

            button.addEventListener("click", () => {

                button.classList.toggle("playing");

                button.textContent =
                    button.classList.contains("playing")
                        ? "Ⅱ"
                        : "▶";
            });
        });
}


// =====================================================
// COMMENTS
// =====================================================

function initializeComments() {

    const modal =
        document.getElementById("commentsModal");

    const closeButton =
        document.getElementById("closeComments");

    const commentsList =
        document.getElementById("commentsList");

    const commentInput =
        document.getElementById("commentInput");

    const sendButton =
        document.getElementById("sendComment");

    if (!modal || !closeButton || !commentsList) {
        return;
    }


    document.querySelectorAll(".comment-button")
        .forEach(button => {

            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";

            button.addEventListener("click", () => {
                modal.classList.add("open");
            });
        });


    if (closeButton.dataset.initialized !== "true") {

        closeButton.dataset.initialized = "true";

        closeButton.addEventListener("click", () => {
            modal.classList.remove("open");
        });


        modal.addEventListener("click", event => {

            if (event.target === modal) {
                modal.classList.remove("open");
            }
        });
    }


    function addComment() {

        if (!commentInput) return;

        const text = commentInput.value.trim();

        if (!text) return;

        const comment =
            document.createElement("div");

        comment.className = "comment";

        comment.innerHTML = `
            <div class="comment-avatar">S</div>

            <div class="comment-body">
                <strong>Shreyas</strong>
                <p>${escapeHTML(text)}</p>

                <div class="comment-actions">
                    <span>Just now</span>
                    <button>Reply</button>
                </div>
            </div>
        `;

        commentsList.appendChild(comment);

        commentInput.value = "";
    }


    if (
        sendButton &&
        sendButton.dataset.initialized !== "true"
    ) {

        sendButton.dataset.initialized = "true";

        sendButton.addEventListener(
            "click",
            addComment
        );
    }


    if (
        commentInput &&
        commentInput.dataset.initialized !== "true"
    ) {

        commentInput.dataset.initialized = "true";

        commentInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" &&
                    !event.shiftKey
                ) {
                    event.preventDefault();
                    addComment();
                }
            }
        );
    }
}


// =====================================================
// CREATE POST
// =====================================================

function initializeCreatePost() {

    const modal =
        document.getElementById("createPostModal");

    const openButton =
        document.querySelector(".create-post-button");

    const closeButton =
        document.getElementById("closeCreatePost");

    const cancelButton =
        document.getElementById("cancelCreatePost");

    const submitButton =
        document.getElementById("submitCreatePost");

    const communityInput =
        document.getElementById("postCommunity");

    const titleInput =
        document.getElementById("postTitle");

    const contentInput =
        document.getElementById("postContent");

    const characterCount =
        document.getElementById("characterCount");

    if (!modal) return;


    if (
        openButton &&
        openButton.dataset.initialized !== "true"
    ) {

        openButton.dataset.initialized = "true";

        openButton.addEventListener("click", () => {
            modal.classList.add("open");
        });
    }


    function closeModal() {
        modal.classList.remove("open");
    }


    if (
        closeButton &&
        closeButton.dataset.initialized !== "true"
    ) {

        closeButton.dataset.initialized = "true";

        closeButton.addEventListener(
            "click",
            closeModal
        );
    }


    if (
        cancelButton &&
        cancelButton.dataset.initialized !== "true"
    ) {

        cancelButton.dataset.initialized = "true";

        cancelButton.addEventListener(
            "click",
            closeModal
        );
    }


    if (contentInput && characterCount) {

        contentInput.addEventListener(
            "input",
            () => {

                characterCount.textContent =
                    `${contentInput.value.length}/500`;
            }
        );
    }


    if (
        submitButton &&
        submitButton.dataset.initialized !== "true"
    ) {

        submitButton.dataset.initialized = "true";

        submitButton.addEventListener(
            "click",
            async () => {

                const community =
                    communityInput
                        ? communityInput.value
                        : "Movies";

                const title =
                    titleInput
                        ? titleInput.value.trim()
                        : "";

                const content =
                    contentInput
                        ? contentInput.value.trim()
                        : "";


                if (!title) {
                    alert("Please enter a post title.");
                    return;
                }


                submitButton.disabled = true;
                submitButton.textContent =
                    "Publishing...";


                try {

                    const response =
                        await fetch(
                            `${API_URL}/api/posts`,
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({
                                    username: "shreyas",
                                    community: community,
                                    title: title,
                                    content: content
                                })
                            }
                        );


                    if (!response.ok) {
                        throw new Error(
                            "Could not create post"
                        );
                    }


                    const result =
                        await response.json();

                    console.log(
                        "KAIRO post created:",
                        result
                    );


                    if (titleInput) {
                        titleInput.value = "";
                    }

                    if (contentInput) {
                        contentInput.value = "";
                    }

                    if (characterCount) {
                        characterCount.textContent =
                            "0/500";
                    }


                    closeModal();

                    await loadPosts();


                } catch (error) {

                    console.error(error);

                    alert(
                        "Could not publish the post. " +
                        "Make sure the KAIRO backend is running."
                    );

                } finally {

                    submitButton.disabled = false;

                    submitButton.textContent =
                        "Publish Post";
                }
            }
        );
    }
}


// =====================================================
// ESCAPE KEY
// =====================================================

document.addEventListener("keydown", event => {

    if (event.key !== "Escape") return;

    const commentsModal =
        document.getElementById("commentsModal");

    const createPostModal =
        document.getElementById("createPostModal");


    if (commentsModal) {
        commentsModal.classList.remove("open");
    }

    if (createPostModal) {
        createPostModal.classList.remove("open");
    }
});


// =====================================================
// SECURITY
// =====================================================

function escapeHTML(value) {

    const div = document.createElement("div");

    div.textContent = value;

    return div.innerHTML;
}