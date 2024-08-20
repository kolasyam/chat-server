import mongoose,{ Schema, model,Types} from "mongoose";
const schema = new Schema(
  {
    content: String,
    attachments: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    sender: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);
export const Message = mongoose.models.message || model("Message", schema);
