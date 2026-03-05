from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from typing import List, Dict, Any
import os

class ChatService:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model = "llama-3.3-70b-versatile"
        if self.api_key:
            self.llm = ChatGroq(
                temperature=0, 
                groq_api_key=self.api_key, 
                model_name=self.model
            )
        else:
            self.llm = None

    def generate_answer(self, query: str, context_chunks: List[str]) -> str:
        if not self.llm:
            return "Error: GROQ_API_KEY not found in environment variables."

        context_text = "\n\n---\n\n".join(context_chunks)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert software engineer assistant. Answer the user's question using the provided code snippets and documentation. If the answer is not in the context, say you don't know."),
            ("user", "Context:\n{context}\n\nQuestion: {question}")
        ])

        chain = prompt | self.llm
        response = chain.invoke({"context": context_text, "question": query})
        return response.content
