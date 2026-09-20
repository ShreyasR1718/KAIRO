const API_URL = "https://kairo-68s0.onrender.com";

// =====================================================
// KAIRO - Frontend JavaScript
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeVoting();
    initializeSaving();
    initializeComments();
    initializeTabs();
    initializeSearch();
    initializeCommunityButtons();
    initializeMusic();
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
            initializePostMenus();

    } catch (error) {
        console.error("Could not load KAIRO posts:", error);
    }
}


// =====================================================
// CREATE DATABASE POST ELEMENT
// =====================================================

function formatPostTime(createdAt) {
    if (!createdAt) {
        return "just now";
    }

    const postDate =
        new Date(createdAt.replace(" ", "T") + "Z");

    const now = new Date();

    const difference =
        Math.floor(
            (now - postDate) / 1000
        );

    if (difference < 60) {
        return "just now";
    }

    const minutes =
        Math.floor(difference / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return postDate.toLocaleDateString();
}
function createPostElement(post) {
    const article = document.createElement("article");

    article.className = "post-card database-post";
    article.dataset.postId = post.id;

    const communityIcon = getCommunityIcon(post.community);

    const loggedInUsername = getLoggedInUsername();

    const isOwnPost =
        loggedInUsername &&
        loggedInUsername === post.username;

    article.innerHTML = `
        <div class="post-top">
            <div class="post-community">
                <div class="post-community-icon">
                    ${communityIcon}
                </div>

                <div class="post-community-info">
                    <strong>${escapeHTML(post.community)}</strong>
                    <span>@${escapeHTML(post.username)} · ${formatPostTime(post.created_at)}</span>
                </div>
            </div>

            <button
                class="post-menu"
                aria-label="Post menu"
                type="button"
            >
                •••
            </button>
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
                <button
                    class="vote-button upvote"
                    aria-label="Upvote"
                >
                    ▲
                </button>

                <span class="vote-count">
                    ${post.votes || 0}
                </span>

                <button
                    class="vote-button downvote"
                    aria-label="Downvote"
                >
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
    document.querySelectorAll(".post-card").forEach(async post => {
        const upvote = post.querySelector(".upvote");
        const downvote = post.querySelector(".downvote");
        const voteCount = post.querySelector(".vote-count");

        if (!upvote || !downvote || !voteCount) return;
        if (upvote.dataset.initialized === "true") return;

        upvote.dataset.initialized = "true";
        downvote.dataset.initialized = "true";

        const postId = post.dataset.postId;
        const username = getLoggedInUsername();

        // Restore the user's saved vote after refresh
        if (postId && username) {
            try {
                const response = await fetch(
                    `${API_URL}/api/posts/${postId}/vote?username=${encodeURIComponent(username)}`
                );

                if (response.ok) {
                    const result = await response.json();

                    if (result.vote === 1) {
                        upvote.classList.add("voted");
                        downvote.classList.remove("voted");
                    } else if (result.vote === -1) {
                        downvote.classList.add("voted");
                        upvote.classList.remove("voted");
                    }
                }
            } catch (error) {
                console.error("Could not restore vote:", error);
            }
        }

        // ---------- UPVOTE ----------

        upvote.addEventListener("click", async () => {
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

            await sendVote(
                postId,
                change,
                voteCount,
                upvote,
                downvote
            );
        });

        // ---------- DOWNVOTE ----------

        downvote.addEventListener("click", async () => {
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

            await sendVote(
                postId,
                change,
                voteCount,
                upvote,
                downvote
            );
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
    try {
        const result = await sendSingleVote(postId, change);

        voteCount.textContent = result.votes;

        if (change === 1) {
            if (downvote.classList.contains("voted")) {
                downvote.classList.remove("voted");
            } else {
                upvote.classList.add("voted");
                downvote.classList.remove("voted");
            }
        } else if (change === -1) {
            if (upvote.classList.contains("voted")) {
                upvote.classList.remove("voted");
            } else {
                downvote.classList.add("voted");
                upvote.classList.remove("voted");
            }
        } else if (change === 2) {
            upvote.classList.add("voted");
            downvote.classList.remove("voted");
        } else if (change === -2) {
            downvote.classList.add("voted");
            upvote.classList.remove("voted");
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
                change: change,
                username: getLoggedInUsername()
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

async function initializeSaving() {
    document.querySelectorAll(".save-button").forEach(button => {

        if (button.dataset.initialized === "true") return;

        button.dataset.initialized = "true";

        const postCard = button.closest(".post-card");

        if (!postCard) return;

        const postId = postCard.dataset.postId;

        const username = getLoggedInUsername();

        if (!username || !postId) return;

        const text = button.querySelector("span");

        // Check whether this post is already saved
        fetch(
            `${API_URL}/api/posts/${postId}/save?username=${encodeURIComponent(username)}`
        )
            .then(response => {
                if (!response.ok) {
                    throw new Error("Failed to get saved status");
                }

                return response.json();
            })
            .then(data => {

                if (data.saved) {
                    button.classList.add("saved");

                    if (text) {
                        text.textContent = "Saved";
                    }
                }

            })
            .catch(error => {
                console.error(
                    "Could not get saved status:",
                    error
                );
            });

        button.addEventListener("click", async () => {

            const isSaved =
                button.classList.contains("saved");

            try {

                let response;

                if (isSaved) {

                    // Unsave the post
                    response = await fetch(
                        `${API_URL}/api/posts/${postId}/save?username=${encodeURIComponent(username)}`,
                        {
                            method: "DELETE"
                        }
                    );

                } else {

                    // Save the post
                    response = await fetch(
                        `${API_URL}/api/posts/${postId}/save?username=${encodeURIComponent(username)}`,
                        {
                            method: "POST"
                        }
                    );
                }

                if (!response.ok) {
                    throw new Error(
                        "Failed to update saved status"
                    );
                }

                const data = await response.json();

                if (data.saved) {

                    button.classList.add("saved");

                    if (text) {
                        text.textContent = "Saved";
                    }

                } else {

                    button.classList.remove("saved");

                    if (text) {
                        text.textContent = "Save";
                    }
                }

            } catch (error) {

                console.error(
                    "Could not update saved status:",
                    error
                );

                alert(
                    "Could not update the saved status. Please try again."
                );
            }
        });
    });
}

function initializePostMenus() {
    document.querySelectorAll(".post-menu").forEach(button => {

        if (button.dataset.initialized === "true") return;

        button.dataset.initialized = "true";

        button.addEventListener("click", (event) => {
            event.stopPropagation();

            const postCard =
                button.closest(".post-card");

            if (!postCard) return;

            const postId =
                postCard.dataset.postId;

            const existingMenu =
                postCard.querySelector(".post-menu-dropdown");

            if (existingMenu) {
                existingMenu.remove();
                return;
            }

            const menu =
                document.createElement("div");

            menu.className =
                "post-menu-dropdown";

            const postUsername =
                postCard.querySelector(
                    ".post-community-info span"
                );

            const loggedInUsername =
                getLoggedInUsername();

            const usernameText =
                postUsername
                    ? postUsername.textContent
                    : "";

            const postOwner =
                usernameText
                    .replace("@", "")
                    .split(" · ")[0]
                    .trim();

            const isOwnPost =
                loggedInUsername &&
                loggedInUsername === postOwner;

            if (isOwnPost) {

                menu.innerHTML = `
                    <button class="edit-post-option">
                        Edit
                    </button>

                    <button class="delete-post-option">
                        Delete
                    </button>
                `;

                const editButton =
                    menu.querySelector(".edit-post-option");

                editButton.addEventListener("click", async () => {

                    const titleElement =
                        postCard.querySelector(".post-content h2");

                    const contentElement =
                        postCard.querySelector(".post-content p");

                    const currentTitle =
                        titleElement
                            ? titleElement.textContent
                            : "";

                    const currentContent =
                        contentElement
                            ? contentElement.textContent
                            : "";

                    const newTitle =
                        prompt(
                            "Edit post title:",
                            currentTitle
                        );

                    if (newTitle === null) {
                        return;
                    }

                    if (!newTitle.trim()) {
                        alert("Title cannot be empty.");
                        return;
                    }

                    const newContent =
                        prompt(
                            "Edit post content:",
                            currentContent
                        );

                    if (newContent === null) {
                        return;
                    }

                    try {

                        const response =
                            await fetch(
                                `${API_URL}/api/posts/${postId}`,
                                {
                                    method: "PATCH",
                                    headers: {
                                        "Content-Type":
                                            "application/json"
                                    },
                                    body: JSON.stringify({
                                        username:
                                            loggedInUsername,
                                        title:
                                            newTitle.trim(),
                                        content:
                                            newContent.trim()
                                    })
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                "Failed to update post"
                            );
                        }

                        menu.remove();

                        await loadPosts();

                    } catch (error) {

                        console.error(
                            "Could not edit post:",
                            error
                        );

                        alert(
                            "Could not edit the post. Please try again."
                        );
                    }
                });

                const deleteButton =
                    menu.querySelector(".delete-post-option");

                deleteButton.addEventListener("click", async () => {

                    const confirmed =
                        confirm(
                            "Are you sure you want to delete this post?"
                        );

                    if (!confirmed) {
                        return;
                    }

                    try {

                        const response =
                            await fetch(
                                `${API_URL}/api/posts/${postId}?username=${encodeURIComponent(loggedInUsername)}`,
                                {
                                    method: "DELETE"
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                "Failed to delete post"
                            );
                        }

                        menu.remove();

                        await loadPosts();

                    } catch (error) {

                        console.error(
                            "Could not delete post:",
                            error
                        );

                        alert(
                            "Could not delete the post. Please try again."
                        );
                    }
                });

            } else {

                menu.innerHTML = `
                    <div class="no-post-actions">
                        No actions available
                    </div>
                `;
            }

            postCard.appendChild(menu);
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


    // ---------- OPEN COMMENTS ----------

    document.querySelectorAll(".comment-button")
        .forEach(button => {

            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";

            button.addEventListener("click", async () => {

                const postCard =
                    button.closest(".post-card");

                const postId =
                    postCard
                        ? postCard.dataset.postId
                        : "";

                modal.dataset.postId = postId || "";

                modal.classList.add("open");


                // Database posts load comments
                // from the KAIRO backend.

                if (postId) {
                    await loadComments(postId);
                }
            });
        });


    // ---------- CLOSE BUTTON ----------

    if (closeButton.dataset.initialized !== "true") {

        closeButton.dataset.initialized = "true";

        closeButton.addEventListener("click", () => {
            modal.classList.remove("open");
        });
    }


    // ---------- CLICK OUTSIDE MODAL ----------

    if (modal.dataset.initialized !== "true") {

        modal.dataset.initialized = "true";

        modal.addEventListener("click", event => {

            if (event.target === modal) {
                modal.classList.remove("open");
            }
        });
    }


    // ---------- SEND COMMENT ----------

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


    // ---------- ENTER TO SEND ----------

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
// LOAD COMMENTS FROM DATABASE
// =====================================================

async function loadComments(postId) {

    const commentsList =
        document.getElementById("commentsList");

    if (!commentsList || !postId) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/posts/${postId}/comments`
        );


        if (!response.ok) {
            throw new Error(
                "Failed to load comments"
            );
        }


        const comments =
            await response.json();


        commentsList.innerHTML = "";


        if (comments.length === 0) {

            commentsList.innerHTML = `
                <div class="empty-comments">
                    No comments yet. Be the first to comment!
                </div>
            `;

        } else {

            comments.forEach(comment => {
                renderComment(comment);
            });
        }


        // Update comment count on the post.

        const postCard =
            document.querySelector(
                `.post-card[data-post-id="${postId}"]`
            );


        if (postCard) {

            const countElement =
                postCard.querySelector(
                    ".comment-count"
                );


            if (countElement) {
                countElement.textContent =
                    comments.length;
            }
        }


    } catch (error) {

        console.error(
            "Could not load comments:",
            error
        );


        commentsList.innerHTML = `
            <div class="empty-comments">
                Unable to load comments.
            </div>
        `;
    }
}


// =====================================================
// RENDER DATABASE COMMENT
// =====================================================

function renderComment(comment) {

    const commentsList =
        document.getElementById("commentsList");

    if (!commentsList) {
        return;
    }


    const commentElement =
        document.createElement("div");


    commentElement.className = "comment";


    const username =
        escapeHTML(
            comment.username || "Shreyas"
        );


    const content =
        escapeHTML(
            comment.content || ""
        );


    commentElement.innerHTML = `
        <div class="comment-avatar">
            ${username.charAt(0).toUpperCase()}
        </div>

        <div class="comment-body">

            <strong>${username}</strong>

            <p>${content}</p>

            <div class="comment-actions">
                <span>Just now</span>
                <button type="button">Reply</button>
            </div>

        </div>
    `;


    commentsList.appendChild(
        commentElement
    );
}


// =====================================================
// ADD COMMENT TO DATABASE
// =====================================================

async function addComment() {

    const modal =
        document.getElementById("commentsModal");


    const commentInput =
        document.getElementById("commentInput");


    if (!modal || !commentInput) {
        return;
    }


    const postId =
        modal.dataset.postId;


    const text =
        commentInput.value.trim();


    if (!text) {
        return;
    }


    // The post must be a database post.

    if (!postId) {
        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/posts/${postId}/comments`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    username: getLoggedInUsername(),
                    content: text
                })
            }
        );


        if (!response.ok) {

            throw new Error(
                "Failed to save comment"
            );
        }


        // Clear input after successful save.

        commentInput.value = "";


        // Reload comments from the database.

        await loadComments(postId);


    } catch (error) {

        console.error(
            "Could not save comment:",
            error
        );


        alert(
            "Could not save your comment. Please try again."
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


    // ---------- OPEN MODAL ----------

    if (
        openButton &&
        openButton.dataset.initialized !== "true"
    ) {

        openButton.dataset.initialized = "true";

        openButton.addEventListener("click", () => {

            modal.classList.add("open");
        });
    }


    // ---------- CLOSE MODAL ----------

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


    // ---------- CANCEL ----------

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


    // ---------- CHARACTER COUNT ----------

    if (
        contentInput &&
        characterCount
    ) {

        contentInput.addEventListener(
            "input",
            () => {

                characterCount.textContent =
                    `${contentInput.value.length}/500`;
            }
        );
    }


    // ---------- PUBLISH POST ----------

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

                    alert(
                        "Please enter a post title."
                    );

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
                                    username: getLoggedInUsername(),
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


                    // Clear form

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


                    // Reload posts from database

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

    const div =
        document.createElement("div");


    div.textContent = value;


    return div.innerHTML;
}
/* =========================
   AUTHENTICATION
   ========================= */

const authModal = document.getElementById("authModal");
const authClose = document.getElementById("authClose");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const showSignup = document.getElementById("showSignup");
const showLogin = document.getElementById("showLogin");

const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authMessage = document.getElementById("authMessage");

function openAuthModal(mode = "login") {
    if (!authModal) return;

    authModal.style.display = "flex";
    authMessage.textContent = "";

    if (mode === "signup") {
        loginForm.style.display = "none";
        signupForm.style.display = "flex";

        authTitle.textContent = "Join KAIRO";
        authSubtitle.textContent = "Create your account and find your people.";
    } else {
        loginForm.style.display = "flex";
        signupForm.style.display = "none";

        authTitle.textContent = "Welcome back";
        authSubtitle.textContent = "Log in to continue to KAIRO.";
    }
}

function closeAuthModal() {
    if (!authModal) return;
    authModal.style.display = "none";
    authMessage.textContent = "";
}

if (authModal) {
    authModal.style.display = "none";
}

if (authClose) {
    authClose.addEventListener("click", closeAuthModal);
}

if (showSignup) {
    showSignup.addEventListener("click", () => {
        openAuthModal("signup");
    });
}

if (showLogin) {
    showLogin.addEventListener("click", () => {
        openAuthModal("login");
    });
}

if (authModal) {
    authModal.addEventListener("click", (event) => {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });
}

const loginButton = document.getElementById("loginButton");
const signupButton = document.getElementById("signupButton");
const ctaSignupButton = document.getElementById("ctaSignupButton");

if (loginButton) {
    loginButton.addEventListener("click", () => {
        openAuthModal("login");
    });
}

if (signupButton) {
    signupButton.addEventListener("click", () => {
        openAuthModal("signup");
    });
}

if (ctaSignupButton) {
    ctaSignupButton.addEventListener("click", () => {
        openAuthModal("signup");
    });
}

/* ---------- Login ---------- */

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        authMessage.textContent = "Logging in...";

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Login failed");
            }

            localStorage.setItem("kairoUser", JSON.stringify(data));

            authMessage.textContent = "Login successful!";

            setTimeout(() => {
                window.location.href = "app.html";
            }, 500);

        } catch (error) {
            authMessage.textContent = error.message;
        }
    });
}

/* ---------- Signup ---------- */

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        authMessage.textContent = "Creating account...";

        const username = document.getElementById("signupUsername").value.trim();
        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;

        try {
            const response = await fetch(`${API_URL}/api/auth/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Signup failed");
            }

            authMessage.textContent = "Account created! Logging you in...";

            const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(loginData.detail || "Account created, but login failed");
            }

            localStorage.setItem("kairoUser", JSON.stringify(loginData));

            setTimeout(() => {
                window.location.href = "app.html";
            }, 500);

        } catch (error) {
            authMessage.textContent = error.message;
        }
    });
}
/* =========================
   CURRENT USER HELPER
   ========================= */

function getLoggedInUsername() {
    try {
        const user = JSON.parse(localStorage.getItem("kairoUser"));

        if (user && user.username) {
            return user.username;
        }

        return "";
    } catch (error) {
        console.error("Could not read KAIRO user session:", error);
        return "";
    }
}
/* =========================
   DISPLAY LOGGED-IN USER
   ========================= */

const kairoUser = JSON.parse(localStorage.getItem("kairoUser"));

if (kairoUser) {

    const profileName = document.querySelector(".profile-name");
    const profileAvatar = document.querySelector(".mini-avatar");
    const welcomeMessage = document.querySelector("#welcomeMessage");

if (welcomeMessage) {
    welcomeMessage.textContent = `Good evening, ${kairoUser.username}.`;
}

    if (profileName) {
        profileName.textContent = kairoUser.username;
    }

    if (profileAvatar) {
        profileAvatar.textContent = kairoUser.username
            ? kairoUser.username.charAt(0).toUpperCase()
            : "S";
    }
}
/* =========================
   PROFILE MENU + LOGOUT
   ========================= */

const profileButton = document.querySelector(".profile-button");
const profileMenu = document.getElementById("profileMenu");
const logoutButton = document.getElementById("logoutButton");

if (profileMenu) {
    profileMenu.style.display = "none";
}

if (profileButton && profileMenu) {
    profileButton.addEventListener("click", (event) => {
        event.stopPropagation();

        profileMenu.style.display =
            profileMenu.style.display === "none"
                ? "block"
                : "none";
    });
}

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("kairoUser");
        window.location.href = "index.html";
    });
}

document.addEventListener("click", () => {
    if (profileMenu) {
        profileMenu.style.display = "none";
    }
});