const mongoose = require("mongoose");

const AppSubmissionSchema = new mongoose.Schema(
{
    Title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    Category: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    Subtitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },

    Publisher: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    ImagePath: {
        type: String,
        required: true,
        trim: true
    },

    DetailImagePath: {
		type: String,
		required: true,
		trim: true
	},

    Version: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },

    Framework: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    Description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },

    DownloadUrl: {
        type: String,
        required: true,
        trim: true
    },

    /*
     * Submission status
     *
     * pending  = waiting for admin review
     * approved = approved by admin
     */
    status: {
        type: String,
        enum: [
            "pending",
            "approved"
        ],
        default: "pending",
        required: true,
        index: true
    },

    /*
     * User who submitted the application
     */
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    submittedUsername: {
        type: String,
        required: true,
        trim: true
    }
},
{
    timestamps: true
});


module.exports =
    mongoose.model(
        "AppSubmission",
        AppSubmissionSchema
    );